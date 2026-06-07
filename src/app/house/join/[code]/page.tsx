import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { JoinHouseButton } from "@/components/house/JoinHouseButton";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const metadata = { title: "Join a house" };

type Preview = { name: string; member_count: number; currency: string };

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
              This invite link looks wrong or has expired. Ask your housemate to send it again.
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

            <div className="mt-6">
              {user ? (
                <JoinHouseButton code={code} />
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/house/join/${code}`)}`}
                  className="btn-primary btn-block"
                >
                  Sign in to join
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
