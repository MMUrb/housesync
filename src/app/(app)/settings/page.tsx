import { getAccountSettings, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { InviteBox } from "@/components/house/InviteBox";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { HouseSettingsForm } from "@/components/settings/HouseSettingsForm";
import { DangerZone } from "@/components/settings/DangerZone";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, profile, house } = await requireHouse();
  const account = await getAccountSettings();
  const isOwner = house.created_by === user.id;

  return (
    <div className="space-y-8">
      <PageTitle title="Settings" />

      {/* ACCOUNT — global, the same across every house you're in */}
      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-base font-bold text-slate-900">Your account</h2>
          <p className="text-xs text-slate-500">
            Applies to you everywhere — across all of your houses.
          </p>
        </div>

        <ProfileForm
          userId={user.id}
          initialName={profile?.name ?? ""}
          initialColor={profile?.avatar_color ?? "#6f53f5"}
        />

        <AccountSettingsForm
          userId={user.id}
          email={user.email ?? ""}
          initialPhone={account?.phone ?? ""}
          initialNotifyEmail={account?.notify_email ?? true}
          initialNotifySms={account?.notify_sms ?? false}
        />

        <form action="/auth/signout" method="post">
          <button type="submit" className="btn-secondary btn-block">
            Sign out
          </button>
        </form>
      </section>

      {/* THIS HOUSE — settings for the currently-active house only */}
      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-base font-bold text-slate-900">{house.name}</h2>
          <p className="text-xs text-slate-500">
            Settings for this house only. Switch or add houses from the name at the top-left.
          </p>
        </div>

        <HouseSettingsForm house={house} />

        <div className="card p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">Invite link</p>
          <InviteBox code={house.invite_code} houseName={house.name} />
        </div>

        <DangerZone
          houseId={house.id}
          userId={user.id}
          isOwner={isOwner}
          houseName={house.name}
        />
      </section>

      <p className="pb-4 text-center text-xs text-slate-400">HouseSync · MVP</p>
    </div>
  );
}
