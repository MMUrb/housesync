/**
 * The caller's IP as Vercel's edge saw it. x-real-ip and
 * x-vercel-forwarded-for are set by Vercel; the LEFT end of x-forwarded-for
 * is whatever the client sent, so a script could rotate it for a fresh rate
 * limit (and a fresh visitor) on every request. Off Vercel, the right-most
 * x-forwarded-for entry is the one the nearest proxy added.
 */
export function clientIp(request: Request): string {
  const h = request.headers;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1]! : "unknown";
}
