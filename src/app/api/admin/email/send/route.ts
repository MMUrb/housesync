import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { emailLayout, isEmailConfigured, sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/env";
import { loadEmailAudience } from "@/lib/emailAudience";
import { unsubscribeLinks } from "@/lib/unsubscribe";
import { runPool } from "@/lib/pool";
import {
  MAX_BODY,
  MAX_SUBJECT,
  bodyToHtml,
  firstNameOf,
  personalise,
  pickRecipients,
  type BroadcastKind,
  type Person,
} from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sends an email written in the admin Email tab, from hello@housesync.co.uk
// (sendEmail's sender), to the email each person signed up with. Who may get
// it is decided here from a fresh read of everyone's switches, never trusted
// from the browser, so an opt-out made a second ago is respected.
//
// sendEmail paces itself to 5 a second (Resend's limit is 10), so one send
// fits about 200 people in the function's time; anyone not reached is
// reported rather than silently dropped.
const START_BUDGET_MS = 45_000;

function buildEmail(p: Person, kind: BroadcastKind, subject: string, body: string, siteUrl: string) {
  const first = firstNameOf(p);
  const html = bodyToHtml(personalise(body, first));
  if (kind === "service") {
    return {
      subject: personalise(subject, first),
      html: emailLayout(html, "You're getting this service notice because you have a HouseSync account."),
      headers: undefined,
    };
  }
  const links = unsubscribeLinks(siteUrl, p.id);
  return {
    subject: personalise(subject, first),
    html: emailLayout(
      html,
      `You're getting this because News from HouseSync is on for your account. <a href="${links.page}" style="color:#5f3fe0">Unsubscribe from news</a>, or change all your email choices in Settings.`,
    ),
    // The standard one-click unsubscribe (RFC 8058): Gmail and Apple Mail
    // show their own "Unsubscribe" button for it.
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>, <mailto:hello@housesync.co.uk?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user) || !(await hasAdminSession(user.id))) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Service role isn't configured." }, { status: 503 });
  }
  if (!isEmailConfigured) {
    return NextResponse.json({ error: "No email provider is configured." }, { status: 503 });
  }

  const b = (await request.json().catch(() => null)) as {
    kind?: unknown;
    subject?: unknown;
    body?: unknown;
    ids?: unknown;
    test?: unknown;
  } | null;
  const kind = b?.kind === "service" ? "service" : b?.kind === "news" ? "news" : null;
  const subject = typeof b?.subject === "string" ? b.subject.trim() : "";
  const body = typeof b?.body === "string" ? b.body.trim() : "";
  const ids = Array.isArray(b?.ids) ? b.ids.filter((x): x is string => typeof x === "string") : null;
  if (!kind) return NextResponse.json({ error: "Pick what kind of email it is." }, { status: 400 });
  if (!subject || subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `Add a subject (up to ${MAX_SUBJECT} characters).` }, { status: 400 });
  }
  if (!body || body.length > MAX_BODY) {
    return NextResponse.json({ error: "Add a message (up to 10,000 characters)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const siteUrl = getSiteUrl();
  let people: Person[];
  try {
    people = await loadEmailAudience(admin);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load recipients." }, { status: 500 });
  }

  // A test goes only to you, rendered exactly as a recipient would see it.
  if (b?.test === true) {
    const me = people.find((p) => p.id === user.id) ?? {
      id: user.id,
      email: user.email ?? null,
      name: null,
      house: null,
      emailOn: true,
      newsOn: true,
    };
    if (!me.email) return NextResponse.json({ error: "Your account has no email." }, { status: 400 });
    const mail = buildEmail(me, kind, subject, body, siteUrl);
    try {
      await sendEmail({ to: me.email, toName: me.name ?? undefined, ...mail, subject: `[Test] ${mail.subject}` });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "The test didn't send." }, { status: 502 });
    }
    return NextResponse.json({ test: true, sentTo: me.email });
  }

  // A list (even an empty one) means "just these people"; only a missing list
  // means everyone. An empty pick must never fall through to everyone.
  const recipients = pickRecipients(people, kind, ids);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "Nobody to send to: no one picked has this kind of email switched on." }, { status: 400 });
  }

  const startedAt = Date.now();
  const run = await runPool(
    recipients,
    4,
    async (p) => {
      try {
        await sendEmail({ to: p.email as string, toName: p.name ?? undefined, ...buildEmail(p, kind, subject, body, siteUrl) });
        return true;
      } catch {
        // One bad address mustn't stop everyone else's email.
        return false;
      }
    },
    { deadline: startedAt + START_BUDGET_MS },
  );
  const sent = run.results.filter((r) => r === true).length;
  const failed = run.results.filter((r) => r === false).length;
  const notReached = recipients.length - run.started;

  await admin.from("email_broadcasts").insert({
    kind,
    subject,
    body,
    recipients: recipients.length,
    sent,
    failed,
    sent_by: user.id,
  });

  return NextResponse.json({ recipients: recipients.length, sent, failed, notReached });
}
