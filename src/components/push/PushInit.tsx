"use client";

import { useEffect } from "react";

// Native-app only: registers FCM listeners so the device's push token is saved
// (and refreshed on launch), and taps on a notification open the right page.
// Mounted once in the app layout. Web push is handled by the Settings toggle.
export function PushInit() {
  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const regListener = await PushNotifications.addListener("registration", async (token) => {
          (window as unknown as { __hsPushToken?: string }).__hsPushToken = token.value;
          try {
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "content-type": "application/json" },
              keepalive: true,
              body: JSON.stringify({ kind: "native", token: token.value, platform: Capacitor.getPlatform() }),
            });
          } catch {
            /* best-effort */
          }
        });

        const tapListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const url = action?.notification?.data?.url as string | undefined;
            if (url) window.location.href = url;
          },
        );

        // If the user already granted permission, refresh the token on launch.
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === "granted") {
          try {
            await PushNotifications.register();
          } catch {
            /* ignore */
          }
        }

        cleanup = () => {
          regListener.remove();
          tapListener.remove();
        };
      } catch {
        /* native plugin unavailable — ignore */
      }
    })();
    return () => cleanup();
  }, []);
  return null;
}
