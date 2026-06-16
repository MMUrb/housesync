import Link from "next/link";
import { getAccountSettings, getVisiblePaymentDetails, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { InviteBox } from "@/components/house/InviteBox";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PaymentDetailsForm } from "@/components/settings/PaymentDetailsForm";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { HouseSettingsForm } from "@/components/settings/HouseSettingsForm";
import { DangerZone } from "@/components/settings/DangerZone";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { PushToggle } from "@/components/push/PushToggle";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, profile, house } = await requireHouse();
  const [account, payMap] = await Promise.all([getAccountSettings(), getVisiblePaymentDetails()]);
  const pay = payMap.get(user.id);
  const isOwner = house.created_by === user.id;

  return (
    <div className="space-y-8">
      <PageTitle title="Settings" />

      {/* ACCOUNT — global, the same across every house you're in */}
      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-base font-bold text-slate-900">Your account</h2>
          <p className="text-xs text-slate-500">
            Applies to you everywhere, across all of your houses.
          </p>
        </div>

        <ProfileForm
          userId={user.id}
          initialName={profile?.name ?? ""}
          initialColor={profile?.avatar_color ?? "#6f53f5"}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />

        <PaymentDetailsForm
          userId={user.id}
          initialMonzo={pay?.monzo ?? ""}
          initialPaypal={pay?.paypal ?? ""}
          initialRevolut={pay?.revolut ?? ""}
          initialBank={pay?.bank ?? ""}
          initialShare={pay?.share_with_house ?? true}
        />

        <AccountSettingsForm
          userId={user.id}
          email={user.email ?? ""}
          initialPhone={account?.phone ?? ""}
          initialPhoneVerified={account?.phone_verified ?? false}
          initialNotifyEmail={account?.notify_email ?? true}
          initialNotifySms={account?.notify_sms ?? false}
          emailVerified={Boolean(account?.email_verified_at)}
        />

        <PushToggle
          userId={user.id}
          initialPrefs={{
            message: account?.notify_push_message ?? true,
            expense: account?.notify_push_expense ?? true,
            bill: account?.notify_push_bill ?? true,
            paid: account?.notify_push_paid ?? true,
          }}
        />

        <ThemeToggle />

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

        <Link
          href="/categories"
          className="card flex items-center justify-between p-4 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">Expense categories</p>
            <p className="text-xs text-slate-500">Rename, recolour, or add your own</p>
          </div>
          <span className="text-slate-300">→</span>
        </Link>

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
