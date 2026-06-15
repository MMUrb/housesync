// Browser/native push helpers used by the Settings toggle and the native init.
// Detects platform: native app -> Capacitor Push Notifications (FCM); browser
// -> Web Push (service worker + VAPID).

const VAPID_PUBLIC = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").replace(
  /^[\s﻿​]+|[\s﻿​]+$/g,
  "",
);

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Whether notifications are currently enabled on this device. */
export async function getPushEnabled(): Promise<boolean> {
  try {
    if (await isNative()) return localStorage.getItem("hs_push") === "1";
    if (!webPushSupported() || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (await isNative()) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return { ok: false, reason: "Permission was denied." };
      await PushNotifications.register(); // the registration listener posts the token
      localStorage.setItem("hs_push", "1");
      return { ok: true };
    }
    if (!webPushSupported()) return { ok: false, reason: "This browser can't do notifications." };
    if (!VAPID_PUBLIC) return { ok: false, reason: "Push isn't configured." };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "Permission was denied." };
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "web", subscription: sub.toJSON() }),
    });
    if (!res.ok) return { ok: false, reason: "Couldn't save the subscription." };
    localStorage.setItem("hs_push", "1");
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function disablePush(): Promise<void> {
  try {
    localStorage.removeItem("hs_push");
    if (await isNative()) {
      const token = (window as unknown as { __hsPushToken?: string }).__hsPushToken;
      if (token) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
      return;
    }
    if (!webPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
}
