"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { detectSignupPlatform } from "@/lib/signupChannel";

// Records where an account was registered (web / iOS app / Android app) into
// the user's auth metadata, once. Runs on the first signed-in session rather
// than inside the sign-up form so it covers Apple and Google sign-ins too,
// which never pass through our own form. The one-hour window means only the
// registration session stamps: an old account opening the app months later
// must not be re-labelled with whatever device it happens to be on today.
const STAMP_WINDOW_MS = 60 * 60 * 1000;

export function SignupPlatformStamp() {
  useEffect(() => {
    const supabase = createClient();
    // getSession reads local storage — no network for signed-out visitors,
    // which matters because this mounts in the root layout (a fresh signup
    // hasn't joined a house yet, so the app layout would miss them).
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const user = session?.user;
        if (!user) return;
        if (user.user_metadata?.signup_platform) return; // already stamped
        if (Date.now() - new Date(user.created_at).getTime() > STAMP_WINDOW_MS) return;
        return supabase.auth.updateUser({
          data: { signup_platform: detectSignupPlatform() },
        });
      })
      .catch(() => {
        /* best-effort — never disturb the session over analytics */
      });
  }, []);
  return null;
}
