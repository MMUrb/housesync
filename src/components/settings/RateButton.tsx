"use client";

import { useEffect, useState } from "react";
import { getPlatform } from "@/components/push/pushClient";

// The App Store review deep-link only resolves once the app is public; until
// then iOS taps land on an "app not available" page. Fine for us: this ships in
// the release where the App Store listing is already live.
const APP_STORE_ID = "6783905558";
const IOS_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
const PLAY_URL = "https://play.google.com/store/apps/details?id=uk.co.housesync";

// Sends the user to the right store to leave a rating: App Store on iPhone,
// Google Play on Android and on the website (where most visitors are on Android).
export function RateButton() {
  const [url, setUrl] = useState(PLAY_URL);

  useEffect(() => {
    getPlatform().then((p) => setUrl(p === "ios" ? IOS_URL : PLAY_URL));
  }, []);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="card flex items-center justify-between p-4 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
    >
      <div>
        <p className="text-sm font-medium text-slate-800">Rate HouseSync</p>
        <p className="text-xs text-slate-500">Enjoying the app? A quick rating really helps us.</p>
      </div>
      <span className="shrink-0 text-amber-400">★</span>
    </a>
  );
}
