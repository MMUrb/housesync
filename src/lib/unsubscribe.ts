import "server-only";
import { checkUnsubscribeToken, makeUnsubscribeToken } from "@/lib/unsubscribeToken";

// The secret behind unsubscribe links. A dedicated UNSUBSCRIBE_SECRET if set,
// otherwise the service-role key (already secret, server-only). Rotating
// either invalidates links in emails already sent, which only means an old
// link stops working; Settings always does.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function unsubscribeLinks(siteUrl: string, userId: string): { page: string; oneClick: string } {
  const qs = new URLSearchParams({ u: userId, t: makeUnsubscribeToken(userId, secret()) });
  return {
    // What a person taps in the email.
    page: `${siteUrl}/unsubscribe?${qs}`,
    // What Gmail / Apple Mail call for their own "Unsubscribe" button.
    oneClick: `${siteUrl}/api/email/unsubscribe?${qs}`,
  };
}

export function isValidUnsubscribe(userId: string, token: string): boolean {
  return checkUnsubscribeToken(userId, token, secret());
}
