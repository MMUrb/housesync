"use client";

import { useEffect, useState } from "react";
import { getPlatform } from "@/components/push/pushClient";

// The "Support HouseSync" trio as a 3-up tile band: one row of friendly
// actions instead of three stacked cards. Same behaviour as the old
// ShareAppButton / RateButton / TourButton.

const SHARE_URL = "https://housesync.co.uk";
const SHARE_TEXT =
  "HouseSync makes splitting bills, chores and rent with your housemates easy. Give it a go:";

// The App Store review deep-link only resolves once the app is public; until
// then iOS taps land on an "app not available" page.
const APP_STORE_ID = "6783905558";
const IOS_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
const PLAY_URL = "https://play.google.com/store/apps/details?id=uk.co.housesync";

function Tile({
  icon,
  iconClass,
  title,
  sub,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  sub: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className={`mx-auto grid h-9 w-9 place-items-center rounded-[10px] ${iconClass}`}>
        {icon}
      </span>
      <span className="mt-2 block text-[13px] font-bold text-slate-800">{title}</span>
      <span className="block text-[11px] text-slate-400">{sub}</span>
    </>
  );
  const cls =
    "card block w-full p-4 text-center transition touch-manipulation hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function SupportTiles() {
  const [copied, setCopied] = useState(false);
  const [rateUrl, setRateUrl] = useState(PLAY_URL);

  useEffect(() => {
    getPlatform().then((p) => setRateUrl(p === "ios" ? IOS_URL : PLAY_URL));
  }, []);

  async function share() {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: "HouseSync", text: SHARE_TEXT, url: SHARE_URL });
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Tile
        onClick={share}
        iconClass="bg-slate-100 text-slate-500"
        title="Share"
        sub={copied ? "Link copied" : "Tell your mates"}
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="6" cy="12" r="2.6" />
            <circle cx="17.5" cy="6" r="2.6" />
            <circle cx="17.5" cy="18" r="2.6" />
            <path d="m8.3 10.8 6.9-3.6M8.3 13.2l6.9 3.6" />
          </svg>
        }
      />
      <Tile
        href={rateUrl}
        iconClass="bg-amber-50 text-amber-500"
        title="Rate"
        sub="Leave a review"
        icon={
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
            <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />
          </svg>
        }
      />
      <Tile
        onClick={() => window.dispatchEvent(new Event("hs:open-tour"))}
        iconClass="bg-slate-100 text-slate-500"
        title="Show me around"
        sub="Replay the intro"
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m15 9-2.2 5L8 16.2l2.2-5z" />
          </svg>
        }
      />
    </div>
  );
}
