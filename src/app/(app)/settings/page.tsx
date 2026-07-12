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
import { SignOutButton } from "@/components/settings/SignOutButton";
import { ShareAppButton } from "@/components/settings/ShareAppButton";
import { PushToggle } from "@/components/push/PushToggle";
import { EmailToggle } from "@/components/settings/EmailToggle";
import { SocialLinks } from "@/components/SocialLinks";

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
            chore: account?.notify_push_chore ?? true,
            member: account?.notify_push_member ?? true,
          }}
        />

        <EmailToggle
          userId={user.id}
          initialPrefs={{
            bills: account?.notify_email_bills ?? true,
            nudges: account?.notify_email_nudges ?? true,
            product: account?.notify_email_product ?? true,
            tips: account?.notify_email_tips ?? true,
            surveys: account?.notify_email_surveys ?? true,
            offers: account?.notify_email_offers ?? true,
          }}
        />

        <ThemeToggle />

        <SignOutButton />
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

        <div className="card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">Your data</p>
            <p className="text-xs text-slate-500">Download a copy of your HouseSync data (JSON).</p>
          </div>
          <a
            href="/api/account/export"
            download
            className="btn-secondary shrink-0 px-3 py-2 text-sm"
          >
            Download
          </a>
        </div>

        <DangerZone
          houseId={house.id}
          userId={user.id}
          isOwner={isOwner}
          houseName={house.name}
        />
      </section>

      {/* SUPPORT & COMMUNITY */}
      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-base font-bold text-slate-900">Support HouseSync</h2>
          <p className="text-xs text-slate-500">Help us grow, and tell us what you think.</p>
        </div>

        <ShareAppButton />

        <a
          href="mailto:hello@housesync.co.uk?subject=HouseSync%20feedback"
          className="card flex items-center justify-between p-4 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">Send feedback</p>
            <p className="text-xs text-slate-500">Report a bug or suggest an idea</p>
          </div>
          <span className="text-slate-300">→</span>
        </a>

        <div className="card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Follow us</p>
            <p className="text-xs text-slate-500">Updates and tips on our socials</p>
          </div>
          <SocialLinks />
        </div>
      </section>

      <div className="flex flex-col items-center gap-1.5 pb-4 text-center">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/privacy" className="transition hover:text-slate-600">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/terms" className="transition hover:text-slate-600">
            Terms of Use
          </Link>
        </div>
        <p className="text-xs text-slate-400">HouseSync · MVP</p>
      </div>
    </div>
  );
}
