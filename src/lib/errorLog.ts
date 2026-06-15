import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { emailLayout, isEmailConfigured, sendEmail } from "@/lib/email";

// Central error sink. Writes to error_logs (shown in /hq-k4p9/errors) and, for
// server errors, emails the admins — throttled to the first error in a 15-min
// burst so an incident doesn't flood the inbox. Must NEVER throw: error logging
// failing should not break the request that triggered it.

const ALERT_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const ALERT_WINDOW_MS = 15 * 60 * 1000;

type LogInput = {
  source: "server" | "client";
  message: string;
  stack?: string | null;
  url?: string | null;
  userId?: string | null;
  userAgent?: string | null;
  digest?: string | null;
};

function clip(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

export async function logError(input: LogInput): Promise<void> {
  if (!isAdminConfigured) return;
  try {
    const admin = createAdminClient();
    const message = clip(input.message, 2000) || "Unknown error";
    const url = clip(input.url, 500);
    await admin.from("error_logs").insert({
      source: input.source,
      message,
      stack: clip(input.stack, 8000),
      url,
      user_id: input.userId ?? null,
      user_agent: clip(input.userAgent, 500),
      digest: clip(input.digest, 200),
    });

    // Email alert for server errors only, and only the first of a burst.
    if (input.source === "server" && isEmailConfigured && ALERT_EMAILS.length > 0) {
      const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString();
      const { count } = await admin
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .eq("source", "server")
        .gte("created_at", since);
      if ((count ?? 0) <= 1) {
        const body = `
          <h1 style="font-size:18px;margin:0 0 10px">HouseSync server error</h1>
          <p style="margin:0 0 8px"><strong>${escapeHtml(message)}</strong></p>
          ${url ? `<p style="margin:0 0 8px;color:#475569;font-size:13px">Path: ${escapeHtml(url)}</p>` : ""}
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px">${new Date().toUTCString()}</p>
          <p style="margin:18px 0 0">
            <a href="https://housesync.co.uk/hq-k4p9/errors" style="color:#6f53f5;font-weight:bold">View in admin</a>
          </p>`;
        await Promise.all(
          ALERT_EMAILS.map((to) =>
            sendEmail({
              to,
              subject: "HouseSync server error alert",
              html: emailLayout(body, "You're receiving this because you're a HouseSync admin."),
            }).catch(() => {}),
          ),
        );
      }
    }
  } catch {
    /* never let logging throw */
  }
}
