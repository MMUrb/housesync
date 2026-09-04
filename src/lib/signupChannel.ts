// Where did an account register: the website, the iOS app or the Android app?
//
// Accounts created after the SignupPlatformStamp shipped carry an exact
// `signup_platform` in their auth metadata. Older accounts are estimated from
// the signals that exist: Apple sign-in only happens in the iOS app, and a
// native push token names its platform. Anything left is assumed web, which
// the admin UI labels as an estimate rather than a fact.

export type SignupChannel = "web" | "ios-app" | "android-app";

export type ChannelResult = { channel: SignupChannel; exact: boolean };

export function channelOf(
  user: { signup_platform?: string | null; provider?: string | null },
  pushPlatforms: Set<string> | undefined,
): ChannelResult {
  const stamped = user.signup_platform;
  if (stamped === "web" || stamped === "ios-app" || stamped === "android-app") {
    return { channel: stamped, exact: true };
  }
  if (user.provider === "apple") return { channel: "ios-app", exact: false };
  if (pushPlatforms?.has("ios")) return { channel: "ios-app", exact: false };
  if (pushPlatforms?.has("android")) return { channel: "android-app", exact: false };
  return { channel: "web", exact: false };
}

/**
 * Which platform is this browser running on right now? Used at registration
 * time to stamp the account. The iOS webview is the awkward one: its user
 * agent carries no marker at all, but unlike Safari it lacks the "Safari/"
 * token. Capacitor's injected bridge is checked first as the strongest signal.
 */
export function detectSignupPlatform(): SignupChannel {
  if (typeof window === "undefined") return "web";
  const ua = navigator.userAgent;
  const hasBridge = "Capacitor" in window;
  if (/Android/i.test(ua) && (hasBridge || /; wv\)/.test(ua))) return "android-app";
  if (/iPhone|iPad|iPod/i.test(ua) && (hasBridge || !/Safari\//.test(ua))) return "ios-app";
  return "web";
}
