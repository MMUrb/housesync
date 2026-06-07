"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl, OAUTH_PROVIDERS } from "@/lib/env";
import { setLeaveGuard } from "@/lib/leaveGuard";

type Mode = "signin" | "signup";
type OAuthProvider = "google" | "azure" | "apple";

const PROVIDER_CONFIG: Record<
  string,
  { label: string; provider: OAuthProvider; scopes?: string; Icon: ComponentType }
> = {
  google: { label: "Google", provider: "google", Icon: GoogleIcon },
  azure: { label: "Microsoft", provider: "azure", scopes: "email", Icon: MicrosoftIcon },
  apple: { label: "Apple", provider: "apple", Icon: AppleIcon },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = createClient();

  const providers = OAUTH_PROVIDERS.filter((p) => PROVIDER_CONFIG[p]);

  // Warn before leaving mid sign-up (when fields have been filled in).
  useEffect(() => {
    const hasInput = Boolean(name || email || password);
    setLeaveGuard(mode === "signup" && hasInput);
    return () => setLeaveGuard(false);
  }, [mode, name, email, password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider, scopes?: string) {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
        ...(scopes ? { scopes } : {}),
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
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
          <input
            id="password"
            type="password"
            className="input"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
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
    </div>
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
