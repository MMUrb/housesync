export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f7bff" />
          <stop offset="1" stopColor="#5f3fe0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#logoGrad)" />
      <path
        d="M256 120 L392 232 V392 a16 16 0 0 1 -16 16 H136 a16 16 0 0 1 -16 -16 V232 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="26"
        strokeLinejoin="round"
      />
      <path
        d="M212 300 a44 44 0 1 1 13 53"
        fill="none"
        stroke="#ffffff"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d="M214 268 v34 h34"
        fill="none"
        stroke="#ffffff"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <LogoMark className="h-7 w-7" />
      <span>
        House<span className="text-brand-600">Sync</span>
      </span>
    </span>
  );
}
