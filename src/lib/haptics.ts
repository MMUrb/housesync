// Fire-and-forget haptic feedback. On device it uses the native Taptic Engine /
// vibrator via @capacitor/haptics; in a browser the plugin falls back to the Web
// Vibration API (works on Android), and it silently no-ops where unsupported
// (iOS Safari, desktop, older devices). Never throws, so call sites can `void`
// it without a try/catch.
export type Haptic = "light" | "medium" | "success";

export async function haptic(kind: Haptic = "light"): Promise<void> {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success") {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
    }
  } catch {
    /* plugin unavailable or blocked — no-op */
  }
}
