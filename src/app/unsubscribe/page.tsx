import { HomeLogoLink } from "@/components/HomeLogoLink";
import { UnsubscribeCard } from "@/components/email/UnsubscribeCard";

export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

// Where the "Unsubscribe from news" link in a HouseSync email lands. Public:
// the signed link is the proof, no sign-in needed.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string }>;
}) {
  const { u = "", t = "" } = await searchParams;
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <HomeLogoLink className="mx-auto" logoClassName="text-xl" />
      <UnsubscribeCard u={u} t={t} />
    </main>
  );
}
