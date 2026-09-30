import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";

/**
 * Invite links (migration 0046): only the house admin can make one, each is a
 * fresh random code, and it works for 10 minutes for anyone who taps it in
 * that time. After that the admin makes a new one.
 */
export type Invite = {
  code: string;
  /** Client-clock deadline (ms). Taken from the link's lifetime, not the
   *  server's timestamp, so a phone with a wrong clock still counts down right. */
  deadline: number;
};

export function inviteUrl(code: string) {
  return `${getSiteUrl()}/house/join/${code}`;
}

export async function createInvite(houseId: string): Promise<Invite> {
  const startedAt = Date.now();
  const { data, error } = await createClient().rpc("create_house_invite", { p_house_id: houseId });
  if (error) throw error;
  const row = data as { code: string; ttl_seconds: number };
  // Measured from BEFORE the request, so the countdown never runs past the
  // server's own expiry.
  return { code: row.code, deadline: startedAt + row.ttl_seconds * 1000 };
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * The phone's own share sheet in the apps, the browser's where it has one,
 * otherwise the link goes on the clipboard. The web share sheet needs a fresh
 * tap, so when it refuses (the tap was spent on a confirm sheet or a network
 * call) we copy instead.
 */
export async function shareInvite(
  invite: Invite,
  opts: { title: string; text: string; dialogTitle?: string },
): Promise<ShareResult> {
  const url = inviteUrl(invite.code);
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: opts.title, text: opts.text, url, dialogTitle: opts.dialogTitle });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return "shared";
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** "9:41" for a countdown. */
export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
