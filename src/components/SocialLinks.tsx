// Social links + brand icons, reused in the app footer and the landing footer.

export function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82a4.3 4.3 0 0 1-1.05-2.82h-3.2v12.6a2.57 2.57 0 1 1-2.57-2.57c.27 0 .53.04.78.12V9.9a5.78 5.78 0 1 0 5 5.72V9.01a7.43 7.43 0 0 0 4.33 1.39V7.2a4.3 4.3 0 0 1-3.29-1.38z" />
    </svg>
  );
}

export function SocialLinks() {
  return (
    <div className="flex items-center gap-1.5">
      <a
        href="https://www.instagram.com/housesync.uk/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="HouseSync on Instagram"
        className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
      >
        <InstagramIcon />
      </a>
      <a
        href="https://www.tiktok.com/@housesync.uk"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="HouseSync on TikTok"
        className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
      >
        <TikTokIcon />
      </a>
    </div>
  );
}

/** Compact "Follow us for updates" row + social icons — used in the app footer. */
export function FollowUs() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
      <span>Follow us for updates</span>
      <SocialLinks />
    </div>
  );
}
