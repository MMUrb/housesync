import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { JoinHouseButton } from "@/components/house/JoinHouseButton";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const metadata = { title: "Join a house" };

// Links last 10 minutes (0046). An expired link comes back with expired=true
// and no house details. removed: the signed-in visitor was removed by the
// admin and hasn't been invited back (always false when signed out).
type Preview = {
  name: string | null;
  member_count: number | null;
  currency: string | null;
  removed?: boolean;
  expires_at?: string | null;
  expired?: boolean;
};

export default async function JoinHousePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_house_preview", { p_invite_code: code });
  const preview = (Array.isArray(data) ? data[0] : data) as Preview | undefined;
  const user = await getUser();
  // Server-rendered text (this page has no client clock), rounded up so "1
  // minute" covers the last seconds too.
  const minutesLeft = preview?.expires_at
    ? Math.max(1, Math.ceil((new Date(preview.expires_at).getTime() - Date.now()) / 60_000))
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <HomeLogoLink className="mx-auto" logoClassName="text-lg" />

      <div className="card mt-8 p-6 text-center">
        {!preview ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl">
              🤔
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">Invite not found</h1>
            <p className="mt-1 text-sm text-slate-600">
              This invite link looks wrong or has expired. Ask the house admin to send you a new
              one.
            </p>
            <Link href="/" className="btn-secondary btn-block mt-5">
              Go home
            </Link>
          </>
        ) : preview.expired ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-2xl">
              ⏱️
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">This invite link has expired</h1>
            <p className="mt-1 text-sm text-slate-600">
              Invite links only work for 10 minutes. Ask the house admin to send you a new one.
            </p>
            <Link href="/" className="btn-secondary btn-block mt-5">
              Go home
            </Link>
          </>
        ) : preview.removed ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-2xl">
              🚪
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">You can&apos;t rejoin yet</h1>
            <p className="mt-1 text-sm text-slate-600">
              You were removed from {preview.name}. You can join again once the house admin
              invites you back.
            </p>
            <Link href="/" className="btn-secondary btn-block mt-5">
              Go home
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-2xl">
              🏠
            </div>
            <p className="mt-3 text-sm text-slate-500">You&apos;ve been invited to join</p>
            <h1 className="text-2xl font-bold text-slate-900">{preview.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {preview.member_count} {preview.member_count === 1 ? "housemate" : "housemates"} already here
            </p>
            {minutesLeft !== null && (
              <p className="mt-2 text-xs text-slate-400">
                This link works for another {minutesLeft} {minutesLeft === 1 ? "minute" : "minutes"}.
              </p>
            )}

            <div className="mt-6">
              {user ? (
                <JoinHouseButton code={code} />
              ) : (
                <>
                  {/* Most people opening an invite are brand-new — land them on
                      Create account, with sign-in one tap below. */}
                  <Link
                    href={`/login?next=${encodeURIComponent(`/house/join/${code}`)}&mode=signup`}
                    className="btn-primary btn-block"
                  >
                    Create an account to join
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/house/join/${code}`)}`}
                    className="btn-ghost btn-block mt-2 text-sm"
                  >
                    Already have an account? Sign in
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
