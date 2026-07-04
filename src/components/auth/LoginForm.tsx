"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl, OAUTH_PROVIDERS } from "@/lib/env";
import { safeNextPath } from "@/lib/safeRedirect";
import { setLeaveGuard } from "@/lib/leaveGuard";
import { reportClientError } from "@/components/ErrorReporter";

type Mode = "signin" | "signup";
type OAuthProvider = "google" | "azure" | "apple";

// Custom URL scheme used to return to the native (Capacitor) app after OAuth
// completes in the system browser. The real scheme is the running app's id
// (uk.co.housesync for the main app, uk.co.housesync.admin for the admin app),
// read at runtime via App.getInfo() — this is only the fallback. Each scheme
// must match that app's manifest intent-filter AND be allow-listed in
// Supabase Auth → URL Configuration → Redirect URLs.
const NATIVE_SCHEME = "uk.co.housesync";

const PROVIDER_CONFIG: Record<
  string,
  { label: string; provider: OAuthProvider; scopes?: string; Icon: ComponentType }
> = {
  google: { label: "Google", provider: "google", Icon: GoogleIcon },
  azure: { label: "Microsoft", provider: "azure", scopes: "email", Icon: MicrosoftIcon },
  apple: { label: "Apple", provider: "apple", Icon: AppleIcon },
};

/**
 * Ask the browser's own password manager to save the login (secure — the
 * browser stores it, we never do). Triggers the native "Save password?" prompt
 * in supporting browsers; others fall back to their built-in autofill via the
 * autocomplete attributes below.
 */
async function offerToSaveCredentials(email: string, password: string) {
  try {
    const w = window as unknown as { PasswordCredential?: new (data: object) => Credential };
    if (w.PasswordCredential && navigator.credentials?.store) {
      const cred = new w.PasswordCredential({ id: email, password, name: email });
      await navigator.credentials.store(cred);
    }
  } catch {
    /* unsupported or dismissed — fine */
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = createClient();

  // The deep-link scheme for this native app (= its app id), set on mount.
  const nativeSchemeRef = useRef(NATIVE_SCHEME);

  const providers = OAUTH_PROVIDERS.filter((p) => PROVIDER_CONFIG[p]);

  // Live password requirements (shown on the Create-account form).
  const pwChecks = {
    length: password.length >= 6,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const pwValid = pwChecks.length && pwChecks.upper && pwChecks.number;

  // Warn before leaving mid sign-up (when fields have been filled in).
  useEffect(() => {
    const hasInput = Boolean(name || email || password);
    setLeaveGuard(mode === "signup" && hasInput);
    return () => setLeaveGuard(false);
  }, [mode, name, email, password]);

  // Native app only: finish an OAuth sign-in that happened in the system
  // browser. Google blocks OAuth inside embedded webviews, so in the app we open
  // the provider in the system browser and return here via a deep link
  // (uk.co.housesync://auth/callback?code=...). We then hand the code to the
  // normal server callback route, which exchanges it and sets the session.
  useEffect(() => {
    let removeUrlOpen: (() => void) | undefined;
    let removeFinished: (() => void) | undefined;
    (async () => {
      if (typeof window === "undefined") return;
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");

      try {
        nativeSchemeRef.current = (await App.getInfo()).id || NATIVE_SCHEME;
      } catch {
        /* keep the fallback scheme */
      }

      const urlOpen = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url || !url.startsWith(`${nativeSchemeRef.current}://`)) return;
        const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
        const code = params.get("code");
        const dest = safeNextPath(params.get("next") || next);
        try {
          await Browser.close();
        } catch {
          /* browser already closed — fine */
        }
        if (code) {
          // Reuse the existing server callback to exchange the code → session.
          window.location.href = `/auth/callback?code=${encodeURIComponent(
            code,
          )}&next=${encodeURIComponent(dest)}`;
        } else {
          setLoading(false);
          const err = params.get("error_description") || params.get("error");
          if (err) setError(decodeURIComponent(err));
        }
      });
      removeUrlOpen = () => urlOpen.remove();

      // If the user just closes the browser without signing in, re-enable the UI.
      const finished = await Browser.addListener("browserFinished", () => {
        setLoading(false);
      });
      removeFinished = () => finished.remove();
    })();
    return () => {
      removeUrlOpen?.();
      removeFinished?.();
    };
  }, [next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!pwValid) {
          setError("Your password needs an uppercase letter and a number.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;

        // With email confirmation OFF, sign-up returns a session and we're in.
        // If there's no session, try to sign in straight away (also works when
        // confirmation is off); only if that fails do we ask them to confirm.
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInErr) {
            setNotice(
              "Account created. Check your email (including your spam/junk folder) to confirm, then sign in.",
            );
            setMode("signin");
            setLeaveGuard(false);
            return;
          }
        }

        // New account created with a session — fire the one-time welcome email
        // (best-effort; the server dedupes so it only ever sends once).
        void fetch("/api/email/welcome", { method: "POST", keepalive: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      setLeaveGuard(false);
      await offerToSaveCredentials(email, password);
      router.push(next);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
      // Report unexpected server/database failures (not ordinary "wrong
      // password" / "already registered" cases) so a silent signup-breaking
      // bug surfaces in the admin error log + an alert, instead of hiding.
      const status = (err as { status?: number })?.status ?? 0;
      if (status >= 500 || /database error|unexpected|relation|not-null|violates/i.test(msg)) {
        reportClientError(`Auth ${mode} failed: ${msg}`, {
          stack: err instanceof Error ? err.stack : null,
          url: "/login",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider, scopes?: string) {
    setError(null);
    setLoading(true);

    // In the native app, Google (and others) block OAuth inside the webview, so
    // open the provider in the system browser and return via a deep link.
    let isNative = false;
    if (typeof window !== "undefined") {
      const { Capacitor } = await import("@capacitor/core");
      isNative = Capacitor.isNativePlatform();
    }

    const redirectTo = isNative
      ? `${nativeSchemeRef.current}://auth/callback?next=${encodeURIComponent(next)}`
      : `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
        // In the app, get the URL back instead of auto-redirecting the webview.
        skipBrowserRedirect: isNative,
        ...(scopes ? { scopes } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (isNative && data?.url) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url });
      // The appUrlOpen listener above completes sign-in when the user returns.
    }
  }

  return (
    <div className="card mt-8 p-6">
      {/* Sign in / Sign up toggle */}
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-lg py-2 transition ${
            mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg py-2 transition ${
            mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Create account
        </button>
      </div>

      {providers.length > 0 && (
        <>
          <div className="space-y-2">
            {providers.map((key) => {
              const cfg = PROVIDER_CONFIG[key];
              const Icon = cfg.Icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleOAuth(cfg.provider, cfg.scopes)}
                  disabled={loading}
                  className="btn-secondary btn-block"
                >
                  <Icon />
                  Continue with {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or use email
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className="input"
              placeholder="e.g. John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-11"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {mode === "signup" && (
            <ul className="mt-2 space-y-1 text-xs">
              <Req ok={pwChecks.length} text="At least 6 characters" />
              <Req ok={pwChecks.upper} text="At least one uppercase letter" />
              <Req ok={pwChecks.number} text="At least one number" />
            </ul>
          )}
          {mode === "signin" && (
            <div className="mt-1.5 text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {notice && (
          <p className="rounded-xl bg-mint-50 px-3 py-2 text-sm text-mint-700">{notice}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary btn-block">
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {/* Consent notice — sits below every sign-in method (OAuth + email) so
          agreement is captured at the point of account creation. */}
      <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="font-medium text-slate-500 underline hover:text-slate-600">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-slate-500 underline hover:text-slate-600">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

function Req({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-mint-600" : "text-red-600"}`}>
      <span aria-hidden className="font-semibold">
        {ok ? "✓" : "✗"}
      </span>
      <span>{text}</span>
    </li>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16.2 16.2 0 0 1-3.1 3.8" />
      <path d="M6.3 6.3A16.3 16.3 0 0 0 2.5 12S6 19 12 19a9.5 9.5 0 0 0 4.2-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.98-.78.88-2.05 1.56-3.1 1.48-.13-1.1.45-2.27 1.1-3 .73-.82 2.02-1.43 3.12-1.46zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.97-.99 1.57-2.39 3.53-4.12 3.55-1.54.02-1.93-1-4.02-.99-2.09.01-2.52.99-4.06.97-1.73-.02-3.05-1.7-4.04-3.27C-.02 16.5-.42 11.36 1.5 8.6c1.21-1.75 3.05-2.78 4.78-2.78 1.76 0 2.87 1.01 4.32 1.01 1.41 0 2.27-1.01 4.31-1.01 1.55 0 3.19.84 4.36 2.3-3.83 2.1-3.2 7.57.73 9.08z" />
    </svg>
  );
}
