import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safeRedirect";

// Handles the redirect back from OAuth (Google) and email-confirmation links.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Sanitised: `next` is attacker-controllable, so only allow in-app paths
  // (never an absolute/protocol-relative URL that could redirect off-site).
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Reaching here means the user proved ownership of their email (Google
      // OAuth, an email-change confirmation, or a recovery link), so mark it
      // verified. Best-effort — never block the redirect.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("account_settings")
            .upsert(
              { user_id: user.id, email_verified_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
        }
      } catch {
        /* ignore */
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not sign you in`);
}
