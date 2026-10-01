// Web push endpoints come from the browser, so a caller can claim any URL.
// The server later sends to it, so only the real push services are allowed:
// otherwise HouseSync's server could be pointed at an internal address.
// Google (Chrome, Opera, Samsung, Brave), Mozilla (Firefox), Microsoft
// (Edge on Windows) and Apple (Safari).
const EXACT_HOSTS = new Set(["fcm.googleapis.com", "android.googleapis.com", "web.push.apple.com"]);
const HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

export function isPushServiceEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((s) => host.endsWith(s));
}
