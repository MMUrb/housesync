import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { NotConfigured } from "@/components/NotConfigured";
import { HomeLogoLink } from "@/components/HomeLogoLink";
import { BackHomeButton } from "@/components/BackHomeButton";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <BackHomeButton className="absolute left-4 [top:calc(1rem_+_env(safe-area-inset-top))]" />
      <HomeLogoLink className="mx-auto" logoClassName="text-xl" />
      <h1 className="mt-8 text-center text-2xl font-bold text-slate-900">
        Welcome to your house
      </h1>
      <p className="mt-1.5 text-center text-sm text-slate-600">
        Split bills, track chores and stay on top of rent, together.
      </p>

      <Suspense fallback={<div className="card mt-8 h-64 animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
