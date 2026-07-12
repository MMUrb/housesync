import "server-only";
import http2 from "node:http2";
import crypto from "node:crypto";
import webpush from "web-push";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Unified push sender: fans a notification out to every device a set of users
// has opted in on — browsers/PWA via Web Push (VAPID), the Android app via FCM.
// Best-effort and never throws; dead subscriptions are pruned automatically.

// Strip BOM / zero-width / surrounding whitespace — some env tooling sneaks a
// leading U+FEFF in, which makes web-push reject the VAPID subject as a URL.
const clean = (s: string | undefined): string =>
  (s ?? "").replace(/^[\s﻿​]+|[\s﻿​]+$/g, "");

const VAPID_PUBLIC = clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const VAPID_PRIVATE = clean(process.env.VAPID_PRIVATE_KEY);
const VAPID_SUBJECT = clean(process.env.VAPID_SUBJECT) || "mailto:hello@housesync.co.uk";
const webPushReady = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (webPushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

function fcmApp(): App | null {
  if (getApps().length) return getApp();
  const b64 = clean(process.env.FIREBASE_SERVICE_ACCOUNT_B64);
  if (!b64) return null;
  try {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      }),
    });
  } catch {
    return null;
  }
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// The account_settings columns that gate each push type. Passing one to
// sendPushToUsers drops any recipient who turned that type off.
export type PushPrefColumn =
  | "notify_push_message"
  | "notify_push_expense"
  | "notify_push_bill"
  | "notify_push_paid"
  | "notify_push_chore"
  | "notify_push_member";

type Sub = {
  id: string;
  kind: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  token: string | null;
  platform: string | null;
};

// --- iOS push via APNs (token-based, .p8) ------------------------------------
// Capacitor Push returns raw APNs device tokens on iOS (not FCM tokens), so
// iPhones are pushed directly over HTTP/2 with an ES256 JWT signed by the .p8
// auth key. Absent config = no-op (iOS just gets nothing, exactly like today).
const APNS_KEY_ID = clean(process.env.APNS_KEY_ID);
const APNS_TEAM_ID = clean(process.env.APNS_TEAM_ID);
const APNS_BUNDLE_ID = clean(process.env.APNS_BUNDLE_ID) || "uk.co.housesync";
// The .p8 contents. Supports real newlines or \n-escaped single-line env values.
const APNS_PRIVATE_KEY = clean(process.env.APNS_PRIVATE_KEY).replace(/\\n/g, "\n");
// TestFlight + App Store builds use the production host; set APNS_SANDBOX=1 only
// for a development (Xcode) build.
const APNS_HOST =
  process.env.APNS_SANDBOX === "1"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
const apnsReady = Boolean(APNS_KEY_ID && APNS_TEAM_ID && APNS_PRIVATE_KEY);

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// APNs lets a provider token be reused for up to an hour; cache and refresh it.
let apnsJwtCache = { token: "", iat: 0 };
function apnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwtCache.token && now - apnsJwtCache.iat < 3000) return apnsJwtCache.token;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const input = `${header}.${payload}`;
  // ES256 JWTs need the raw R||S signature (ieee-p1363), not the default DER.
  const sig = crypto.sign("sha256", Buffer.from(input), {
    key: APNS_PRIVATE_KEY,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${input}.${b64url(sig)}`;
  apnsJwtCache = { token, iat: now };
  return token;
}

// Push one alert to a single iPhone. Never throws; reports whether the token is
// stale (uninstalled / wrong environment) so the caller can prune it.
function sendApns(
  deviceToken: string,
  payload: PushPayload,
): Promise<{ ok: boolean; stale: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: { ok: boolean; stale: boolean }) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    let client: ReturnType<typeof http2.connect> | null = null;
    try {
      client = http2.connect(APNS_HOST);
      client.on("error", () => finish({ ok: false, stale: false }));
      const body = JSON.stringify({
        aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
        url: payload.url ?? "/",
      });
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${apnsJwt()}`,
        "apns-topic": APNS_BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      let status = 0;
      let data = "";
      req.on("response", (headers) => {
        status = Number(headers[":status"]) || 0;
      });
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        client?.close();
        // 410 Unregistered, or 400 BadDeviceToken (registered in the other env).
        const stale = status === 410 || (status === 400 && /BadDeviceToken/.test(data));
        finish({ ok: status === 200, stale });
      });
      req.on("error", () => {
        client?.close();
        finish({ ok: false, stale: false });
      });
      req.setTimeout(10000, () => {
        req.close();
        client?.close();
        finish({ ok: false, stale: false });
      });
      req.end(body);
    } catch {
      client?.close();
      finish({ ok: false, stale: false });
    }
  });
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  prefColumn?: PushPrefColumn,
): Promise<void> {
  if (!isAdminConfigured || userIds.length === 0) return;
  try {
    const db = createAdminClient();

    // Honour per-type opt-outs. Columns default true, so only users who
    // explicitly set this type to false are dropped; a missing row = enabled.
    let targetIds = userIds;
    if (prefColumn) {
      const { data: prefs } = await db
        .from("account_settings")
        .select(`user_id, ${prefColumn}`)
        .in("user_id", userIds);
      const disabled = new Set(
        (prefs ?? [])
          .filter((p) => (p as Record<string, unknown>)[prefColumn] === false)
          .map((p) => (p as { user_id: string }).user_id),
      );
      targetIds = userIds.filter((id) => !disabled.has(id));
      if (targetIds.length === 0) return;
    }

    const { data } = await db
      .from("push_subscriptions")
      .select("id, kind, endpoint, p256dh, auth, token, platform")
      .in("user_id", targetIds);
    const subs = (data ?? []) as Sub[];
    if (subs.length === 0) return;

    const staleIds: string[] = [];
    const tasks: Promise<unknown>[] = [];

    // Web push
    if (webPushReady) {
      for (const s of subs) {
        if (s.kind !== "web" || !s.endpoint || !s.p256dh || !s.auth) continue;
        const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
        tasks.push(
          webpush.sendNotification(subscription, JSON.stringify(payload)).catch((err: unknown) => {
            const code = (err as { statusCode?: number })?.statusCode;
            if (code === 404 || code === 410) staleIds.push(s.id);
          }),
        );
      }
    }

    // Native push (FCM)
    const nativeSubs = subs.filter((s) => s.kind === "native" && s.platform !== "ios" && s.token);
    const tokens = nativeSubs.map((s) => s.token as string);
    const app = tokens.length ? fcmApp() : null;
    if (app && tokens.length) {
      tasks.push(
        getMessaging(app)
          .sendEachForMulticast({
            tokens,
            notification: { title: payload.title, body: payload.body },
            data: { url: payload.url ?? "/" },
            android: { priority: "high" },
          })
          .then((resp) => {
            resp.responses.forEach((r, i) => {
              if (!r.success) {
                const code = r.error?.code ?? "";
                if (
                  code.includes("registration-token-not-registered") ||
                  code.includes("invalid-registration-token")
                ) {
                  staleIds.push(nativeSubs[i].id);
                }
              }
            });
          })
          .catch(() => {}),
      );
    }

    // iOS push (direct APNs) — one HTTP/2 request per iPhone token.
    if (apnsReady) {
      for (const s of subs) {
        if (s.kind !== "native" || s.platform !== "ios" || !s.token) continue;
        tasks.push(
          sendApns(s.token, payload).then((r) => {
            if (r.stale) staleIds.push(s.id);
          }),
        );
      }
    }

    await Promise.allSettled(tasks);
    if (staleIds.length) await db.from("push_subscriptions").delete().in("id", staleIds);
  } catch {
    /* notifications must never break the request that triggered them */
  }
}
