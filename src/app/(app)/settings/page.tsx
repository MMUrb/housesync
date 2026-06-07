import { requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { InviteBox } from "@/components/house/InviteBox";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { HouseSettingsForm } from "@/components/settings/HouseSettingsForm";
import { DangerZone } from "@/components/settings/DangerZone";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, profile, house } = await requireHouse();
  const isOwner = house.created_by === user.id;

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" />

      <Section title="Your profile">
        <ProfileForm
          userId={user.id}
          initialName={profile?.name ?? ""}
          initialColor={profile?.avatar_color ?? "#6f53f5"}
        />
      </Section>

      <Section title="House">
        <HouseSettingsForm house={house} />
      </Section>

      <Section title="Invite link">
        <div className="card p-4">
          <InviteBox code={house.invite_code} houseName={house.name} />
        </div>
      </Section>

      <Section title="Account">
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn-secondary btn-block">
            Sign out
          </button>
        </form>
      </Section>

      <DangerZone
        houseId={house.id}
        userId={user.id}
        isOwner={isOwner}
        houseName={house.name}
      />

      <p className="pb-4 text-center text-xs text-slate-400">HouseSync · MVP</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
