import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;

  if (token && isAdminConfigured) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("account_settings")
      .select("user_id, email_verify_expires")
      .eq("email_verify_token", token)
      .maybeSingle();
    const row = data as { user_id: string; email_verify_expires: string | null } | null;
    if (row?.email_verify_expires && new Date(row.email_verify_expires).getTime() > Date.now()) {
      await admin
        .from("account_settings")
        .update({ email_verified_at: new Date().toISOString() })
        .eq("user_id", row.user_id);
      ok = true;
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="card w-full max-w-sm space-y-4 p-8 text-center">
        <HomeLogoLink className="mx-auto" logoClassName="text-lg" />
        {ok ? (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="text-xl font-bold text-slate-900">Email verified!</h1>
            <p className="text-sm text-slate-600">
              Thanks, your email address is confirmed. You&rsquo;re all set.
            </p>
            <Link href="/dashboard" className="btn-primary btn-block">
              Open HouseSync
            </Link>
          </>
        ) : (
          <>
            <p className="text-4xl">⚠️</p>
            <h1 className="text-xl font-bold text-slate-900">Link expired or invalid</h1>
            <p className="text-sm text-slate-600">
              This verification link has expired or already been used. You can request a fresh one
              from <strong>Settings → Verify now</strong>.
            </p>
            <Link href="/settings" className="btn-secondary btn-block">
              Go to Settings
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
