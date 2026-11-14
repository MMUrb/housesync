import { createHmac, timingSafeEqual } from "crypto";

// Signs unsubscribe links so a link only ever unsubscribes the person it was
// sent to, without them signing in. Pure (the secret is passed in) so it can
// be tested; lib/unsubscribe supplies the server's secret.

function sign(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:news:${userId}`).digest("base64url").slice(0, 32);
}

export function makeUnsubscribeToken(userId: string, secret: string): string {
  if (!secret) throw new Error("No unsubscribe secret configured");
  return sign(userId, secret);
}

/** Fails closed: no secret, no match. */
export function checkUnsubscribeToken(userId: string, token: string, secret: string): boolean {
  if (!secret || !userId || !token) return false;
  const expected = Buffer.from(sign(userId, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
