import "server-only";
import webpush from "web-push";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Unified push sender: fans a notification out to every device a set of users
// has opted in on — browsers/PWA via Web Push (VAPID), the Android app via FCM.
// Best-effort and never throws; dead subscriptions are pruned automatically.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@housesync.co.uk";
const webPushReady = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (webPushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

function fcmApp(): App | null {
  if (getApps().length) return getApp();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "";
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

type Sub = {
  id: string;
  kind: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  token: string | null;
};

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!isAdminConfigured || userIds.length === 0) return;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("push_subscriptions")
      .select("id, kind, endpoint, p256dh, auth, token")
      .in("user_id", userIds);
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
    const nativeSubs = subs.filter((s) => s.kind === "native" && s.token);
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

    await Promise.allSettled(tasks);
    if (staleIds.length) await db.from("push_subscriptions").delete().in("id", staleIds);
  } catch {
    /* notifications must never break the request that triggered them */
  }
}
