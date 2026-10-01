// What one person leaves behind on a shared phone or browser when they sign
// out or delete their account: this device's notification registration (or
// the next person keeps getting their notifications) and their recent
// searches. Best effort: it never throws, and it never holds sign-out up for
// more than a few seconds.

const LOCAL_KEYS = ["hs_push", "hs_search_recent"];
const SESSION_KEYS = ["hs_search_last"];

/**
 * stillSignedIn: true before a sign-out (the server row for this device can
 * still be removed as them); false after an account deletion (the account's
 * rows are already gone with it).
 */
export async function forgetThisDevice({ stillSignedIn }: { stillSignedIn: boolean }): Promise<void> {
  await Promise.race([
    dropPushTarget(stillSignedIn).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  for (const key of LOCAL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage blocked: nothing stored either */
    }
  }
  for (const key of SESSION_KEYS) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* as above */
    }
  }
}

async function unsubscribeOnServer(body: { endpoint?: string; token?: string }) {
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function dropPushTarget(stillSignedIn: boolean) {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const token = (window as unknown as { __hsPushToken?: string }).__hsPushToken;
    if (token && stillSignedIn) await unsubscribeOnServer({ token }).catch(() => {});
    // Retires the device token itself, so even a row this device can't name
    // (the token arrives a moment after launch) stops delivering.
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (!sub) return;
  if (stillSignedIn) await unsubscribeOnServer({ endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
