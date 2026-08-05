// Coarse, privacy-preserving user-agent parsing. We store only these two
// labels, never the raw user-agent string.

/** "iOS" | "Android" | "Windows" | "Mac" | "Linux" | "Other" */
export function uaPlatform(ua: string | null | undefined): string {
  if (!ua) return "Other";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

/** "App" (the Capacitor wrapper) or a coarse browser family. */
export function uaBrowser(ua: string | null | undefined): string {
  if (!ua) return "Other";
  if (/Capacitor|; wv\)|HouseSync/i.test(ua)) return "App";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/CriOS|Chrome/i.test(ua)) return "Chrome";
  if (/FxiOS|Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua)) return "Safari";
  return "Other";
}
