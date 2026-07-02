"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { reportClientError } from "@/components/ErrorReporter";

// Segment-level error boundary. Catches render/runtime errors anywhere in the
// app tree (the root layout still renders, so nav/theme stay intact) and reports
// them into the same error_logs pipeline the admin panel reads. `digest` is
// Next's server-error fingerprint, handy for correlating with server logs.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(`Render error: ${error.message}`, {
      stack: error.stack ?? null,
      url: typeof window !== "undefined" ? window.location.pathname : null,
    });
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <Logo className="mx-auto text-xl" />
        <h1 className="mt-10 text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
          Sorry, that didn&rsquo;t load properly. It&rsquo;s been reported automatically. You can try
          again, or head back home.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary px-5 py-3">
            Try again
          </button>
          <Link href="/" className="btn-secondary px-5 py-3">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
