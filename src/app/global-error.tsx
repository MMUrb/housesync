"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/ErrorReporter";

// Last-resort boundary for errors thrown by the root layout itself. It replaces
// the whole document, so it must render its own <html>/<body> and can't rely on
// the app's CSS or components loading — hence the inline styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(`Global error: ${error.message}`, { stack: error.stack ?? null });
  }, [error]);

  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0a0a16",
          color: "#eceef6",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>
            HouseSync hit a snag
          </h1>
          <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#9698b0", margin: "0 0 24px" }}>
            Something went wrong loading the app. It&rsquo;s been reported. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#6f53f5",
              color: "#fff",
              border: 0,
              borderRadius: "12px",
              padding: "12px 22px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
