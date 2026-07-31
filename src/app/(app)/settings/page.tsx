import Link from "next/link";
import {
  getAccountSettings,
  getHouseCategories,
  getMyHouses,
  getVisiblePaymentDetails,
  requireHouse,
} from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PaymentDetailsForm } from "@/components/settings/PaymentDetailsForm";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { HouseSettingsForm } from "@/components/settings/HouseSettingsForm";
import { DangerZone } from "@/components/settings/DangerZone";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { DisplayCurrencyForm } from "@/components/settings/DisplayCurrencyForm";
import { SignOutButton } from "@/components/settings/SignOutButton";
import { SettingsHero } from "@/components/settings/SettingsHero";
import { NotificationsPanel } from "@/components/settings/NotificationsPanel";
import { SupportTiles } from "@/components/settings/SupportTiles";
import { AppearanceValue } from "@/components/settings/AppearanceValue";
import {
  GroupHeading,
  RowGroup,
  RowDisclosure,
  RowLink,
  RowStatic,
  RowIcon,
  GlyphBell,
  GlyphCard,
  GlyphDoc,
  GlyphDownload,
  GlyphHelp,
  GlyphHouse,
  GlyphMail,
  GlyphMoon,
  GlyphTag,
  GlyphUsers,
  GlyphWarn,
} from "@/components/settings/SettingsRows";
import { SocialLinks } from "@/components/SocialLinks";
import { AppVersion } from "@/components/settings/AppVersion";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** "1st", "2nd", "23rd"... for the rent-day summary. */
function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export default async function SettingsPage() {
  const { user, profile, house, members } = await requireHouse();
  const [account, payMap, houses, categories] = await Promise.all([
    getAccountSettings(),
    getVisiblePaymentDetails(),
    getMyHouses(),
    getHouseCategories(house.id),
  ]);
  const pay = payMap.get(user.id);
  const isOwner = house.created_by === user.id;
  const emailVerified = Boolean(account?.email_verified_at);

  // Row summaries: read your setup without opening anything.
  const filledMethods = [
    pay?.monzo?.trim() && "Monzo",
    pay?.paypal?.trim() && "PayPal",
    pay?.revolut?.trim() && "Revolut",
  ].filter(Boolean) as string[];
  const houseValue = `${house.currency}${house.rent_due_day ? ` · rent on the ${ordinal(house.rent_due_day)}` : ""}`;

  return (
    <div className="space-y-0">
      <PageTitle title="Settings" />

      {/* Identity hero — tap to edit your profile in place. */}
      <div className="mt-1">
        <SettingsHero
          name={profile?.name ?? ""}
          email={user.email ?? ""}
          color={profile?.avatar_color ?? "#6f53f5"}
          avatarUrl={profile?.avatar_url ?? null}
          isOwner={isOwner}
          houseCount={houses.length}
        >
          <div className="card p-5">
            <ProfileForm
              bare
              userId={user.id}
              initialName={profile?.name ?? ""}
              initialColor={profile?.avatar_color ?? "#6f53f5"}
              initialAvatarUrl={profile?.avatar_url ?? null}
            />
          </div>
        </SettingsHero>
      </div>

      {/* YOU — personal, applies across every house */}
      <GroupHeading title="You" scope="personal" />
      <RowGroup>
        <RowDisclosure
          icon={<RowIcon><GlyphCard /></RowIcon>}
          label="Payment details"
          value={filledMethods.length ? filledMethods.join(", ") : undefined}
          chip={
            filledMethods.length === 0 ? (
              <span className="chip bg-amber-50 text-[10px] font-bold text-amber-700">Add</span>
            ) : pay && !pay.share_with_house ? (
              <span className="chip bg-slate-100 text-[10px] text-slate-500">Hidden</span>
            ) : undefined
          }
        >
          <PaymentDetailsForm
            bare
            userId={user.id}
            initialMonzo={pay?.monzo ?? ""}
            initialPaypal={pay?.paypal ?? ""}
            initialRevolut={pay?.revolut ?? ""}
            initialShare={pay?.share_with_house ?? true}
          />
        </RowDisclosure>

        <RowDisclosure icon={<RowIcon><GlyphBell /></RowIcon>} label="Notifications">
          <NotificationsPanel
            userId={user.id}
            initialNotifyEmail={account?.notify_email ?? true}
            initialPush={{
              message: account?.notify_push_message ?? true,
              expense: account?.notify_push_expense ?? true,
              bill: account?.notify_push_bill ?? true,
              paid: account?.notify_push_paid ?? true,
              chore: account?.notify_push_chore ?? true,
              member: account?.notify_push_member ?? true,
            }}
            initialEmailTypes={{
              bills: account?.notify_email_bills ?? true,
              nudges: account?.notify_email_nudges ?? true,
              product: account?.notify_email_product ?? true,
              tips: account?.notify_email_tips ?? true,
              surveys: account?.notify_email_surveys ?? true,
              offers: account?.notify_email_offers ?? true,
            }}
          />
        </RowDisclosure>

        <RowDisclosure
          icon={<RowIcon><GlyphMoon /></RowIcon>}
          label="Appearance"
          value={<AppearanceValue displayCurrency={account?.display_currency ?? null} />}
        >
          <div className="space-y-4">
            <ThemeToggle bare />
            <div className="border-t border-slate-100 pt-4">
              <DisplayCurrencyForm
                bare
                userId={user.id}
                initial={account?.display_currency ?? null}
              />
            </div>
          </div>
        </RowDisclosure>

        <RowDisclosure
          icon={<RowIcon><GlyphMail /></RowIcon>}
          label="Email & account"
          value={user.email ?? undefined}
          chip={
            emailVerified ? undefined : (
              <span className="chip bg-amber-50 text-[10px] font-bold text-amber-700">Verify</span>
            )
          }
        >
          <AccountSettingsForm bare email={user.email ?? ""} emailVerified={emailVerified} />
        </RowDisclosure>
      </RowGroup>

      {/* THIS HOUSE */}
      <GroupHeading title={house.name} scope="house" />
      <RowGroup>
        <RowDisclosure
          icon={<RowIcon tone="house"><GlyphHouse /></RowIcon>}
          label="House settings"
          value={houseValue}
        >
          <HouseSettingsForm bare house={house} />
        </RowDisclosure>

        <RowLink
          href="/categories"
          icon={<RowIcon tone="house"><GlyphTag /></RowIcon>}
          label="Expense categories"
          value={`${categories.length} categories`}
        />

        <RowLink
          href="/housemates"
          icon={<RowIcon tone="house"><GlyphUsers /></RowIcon>}
          label="Invite housemates"
          value={`${members.length} in the house`}
        />

        <RowDisclosure
          icon={<RowIcon><GlyphWarn /></RowIcon>}
          label="Leave or delete this house"
        >
          <DangerZone
            houseId={house.id}
            userId={user.id}
            isOwner={isOwner}
            houseName={house.name}
          />
        </RowDisclosure>
      </RowGroup>

      {/* YOUR DATA */}
      <GroupHeading title="Your data" />
      <RowGroup>
        <RowLink
          href="/api/account/export"
          download
          icon={<RowIcon><GlyphDownload /></RowIcon>}
          label="Download your data"
          value="JSON · all houses"
        />
        <RowLink
          href={`/api/house/statement?house=${house.id}`}
          download
          icon={<RowIcon tone="house"><GlyphDoc /></RowIcon>}
          label="Expenses statement"
          value={`CSV · ${house.name}`}
        />
      </RowGroup>

      {/* HELP */}
      <GroupHeading title="Help" />
      <RowGroup>
        <RowLink
          href="/help"
          icon={<RowIcon><GlyphHelp /></RowIcon>}
          label="Help & FAQ"
        />
        <RowLink
          href="mailto:hello@housesync.co.uk?subject=HouseSync%20feedback"
          icon={<RowIcon><GlyphMail /></RowIcon>}
          label="Send feedback"
          value="hello@housesync.co.uk"
        />
        <RowStatic label="Follow us" right={<SocialLinks />} />
      </RowGroup>

      {/* SUPPORT */}
      <GroupHeading title="Support HouseSync" />
      <SupportTiles />

      <div className="mt-6">
        <SignOutButton />
      </div>

      <div className="flex flex-col items-center gap-1.5 pb-4 pt-8 text-center">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/privacy" className="transition hover:text-slate-600">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/terms" className="transition hover:text-slate-600">
            Terms of Use
          </Link>
        </div>
        <AppVersion />
      </div>
    </div>
  );
}
