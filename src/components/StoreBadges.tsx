import { WebOnly } from "@/components/WebOnly";

const IOS_URL = "https://apps.apple.com/app/id6783905558";
const PLAY_URL = "https://play.google.com/store/apps/details?id=uk.co.housesync";

// App-store download buttons for the marketing site, drawn in-house (official
// badge artwork carries brand-usage rules; the classic dark badge shape is
// generic). Wrapped in WebOnly so people already inside the apps never see
// store buttons for the app they're using.
export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <WebOnly>
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        <Badge
          href={IOS_URL}
          top="Download on the"
          bottom="App Store"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.98-.78.88-2.05 1.56-3.1 1.48-.13-1.1.45-2.27 1.1-3 .73-.82 2.02-1.43 3.12-1.46zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.97-.99 1.57-2.39 3.53-4.12 3.55-1.54.02-1.93-1-4.02-.99-2.09.01-2.52.99-4.06.97-1.73-.02-3.05-1.7-4.04-3.27C-.02 16.5-.42 11.36 1.5 8.6c1.21-1.75 3.05-2.78 4.78-2.78 1.76 0 2.87 1.01 4.32 1.01 1.41 0 2.27-1.01 4.31-1.01 1.55 0 3.19.84 4.36 2.3-3.83 2.1-3.2 7.57.73 9.08z" />
            </svg>
          }
        />
        <Badge
          href={PLAY_URL}
          top="Get it on"
          bottom="Google Play"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M4.1 1.9c-.35.37-.55.94-.55 1.68v16.86c0 .74.2 1.31.56 1.67l.09.08L13.64 12v-.22L4.19 1.82z" />
              <path d="m16.78 15.16-3.14-3.15v-.22l3.15-3.15.07.04 3.73 2.12c1.06.6 1.06 1.59 0 2.2l-3.73 2.12z" opacity=".85" />
              <path d="m16.85 15.12-3.21-3.11L4.1 21.56c.35.37.93.42 1.58.05l11.17-6.5" opacity=".6" />
              <path d="M16.85 8.88 5.68 2.4c-.65-.38-1.23-.33-1.58.04l9.54 9.57z" opacity=".4" />
            </svg>
          }
        />
      </div>
    </WebOnly>
  );
}

function Badge({
  href,
  top,
  bottom,
  icon,
}: {
  href: string;
  top: string;
  bottom: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-2 text-white shadow-card transition hover:bg-slate-800"
    >
      {icon}
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-300">
          {top}
        </span>
        <span className="block text-base font-semibold">{bottom}</span>
      </span>
    </a>
  );
}
