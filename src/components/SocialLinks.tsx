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

export function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
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
      <a
        href="https://www.linkedin.com/company/housesyncuk/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="HouseSync on LinkedIn"
        className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
      >
        <LinkedInIcon />
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
