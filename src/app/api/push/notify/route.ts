import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers, type PushPrefColumn } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// House event -> push the relevant housemates. Membership is enforced via RLS
// (a non-member can't read the house's members), and recipients are always
// re-derived server-side, so the client can't notify arbitrary people.
type Body = {
  type?: "message" | "expense" | "bill_request" | "paid";
  houseId?: string;
  preview?: string; // message
  title?: string; // expense / bill_request
  amount?: string; // expense / paid (already formatted, e.g. "£12.50")
  share?: string; // bill_request (already formatted)
  toUserId?: string; // paid (the person owed)
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const houseId = body.houseId;
  const type = body.type ?? "message";
  if (!houseId) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const { data: members } = await supabase
    .from("house_members")
    .select("user_id")
    .eq("house_id", houseId);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.includes(user.id)) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const [{ data: prof }, { data: house }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase.from("houses").select("name").eq("id", houseId).maybeSingle(),
  ]);
  const actor = (prof?.name as string | undefined)?.trim() || "A housemate";
  const houseName = (house?.name as string | undefined)?.trim() || "your house";
  const clip = (s: string | undefined, n = 140) =>
    (typeof s === "string" ? s.trim() : "").slice(0, n);

  const others = ids.filter((id) => id !== user.id);
  let recipients: string[] = [];
  let title = houseName;
  let bodyText = "";
  let url = "/dashboard";

  switch (type) {
    case "message":
      recipients = others;
      title = `${actor} · ${houseName}`;
      bodyText = clip(body.preview) || "New message";
      url = "/chat";
      break;
    case "expense":
      recipients = others;
      bodyText = `${actor} added ${clip(body.title, 60) || "an expense"}${body.amount ? ` · ${clip(body.amount, 24)}` : ""}`;
      url = "/expenses";
      break;
    case "bill_request":
      recipients = others;
      bodyText = `${actor} requested ${clip(body.title, 60) || "a bill"}${body.share ? ` · your share is ${clip(body.share, 24)}` : ""}`;
      url = "/bills";
      break;
    case "paid": {
      const to = body.toUserId;
      recipients = to && to !== user.id && ids.includes(to) ? [to] : [];
      bodyText = `${actor} paid you${body.amount ? ` ${clip(body.amount, 24)}` : ""}`;
      url = "/housemates";
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown type." }, { status: 400 });
  }

  if (recipients.length === 0) return NextResponse.json({ ok: true });
  const prefByType: Record<NonNullable<Body["type"]>, PushPrefColumn> = {
    message: "notify_push_message",
    expense: "notify_push_expense",
    bill_request: "notify_push_bill",
    paid: "notify_push_paid",
  };
  await sendPushToUsers(
    recipients,
    { title, body: bodyText, url, tag: `${type}-${houseId}` },
    prefByType[type],
  );
  return NextResponse.json({ ok: true });
}
