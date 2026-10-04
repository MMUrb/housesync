import { Capacitor } from "@capacitor/core";

// One way to share things (the app itself, for now) that always ends in
// a proper share sheet, never a silent copy:
// - in the apps, the phone's own sheet (WhatsApp, Instagram, Messages, Copy…)
//   via @capacitor/share, which both store builds include;
// - in a phone or tablet browser, the browser's sheet (Web Share);
// - on a computer, HouseSync's own sheet (components/app/ShareSheet), because
//   desktop browsers either have no share sheet or a thin one.
// Invite links keep their own flow (lib/invites.ts): that box already offers
// Share, WhatsApp and Copy side by side.

export type SharePayload = {
  /** Heading for the sheet, e.g. "Share HouseSync". */
  dialogTitle?: string;
  /** Subject line where the target has one (email). */
  title?: string;
  text: string;
  url?: string;
};

export type ShareOutcome = "shared" | "cancelled" | "sheet" | "copied" | "failed";

/** The text a target receives when it takes one string: the message, then the link. */
export function shareMessage(p: SharePayload): string {
  return p.url ? `${p.text} ${p.url}` : p.text;
}

// The sheet's presenter, registered by ShareSheetHost (one per page, like the
// toast host), so any handler can open it without threading props around.
let presentSheet: ((p: SharePayload) => void) | null = null;

export function registerShareSheet(present: (p: SharePayload) => void): () => void {
  presentSheet = present;
  return () => {
    if (presentSheet === present) presentSheet = null;
  };
}

/** In the apps, or a touch-screen browser: where the phone's own sheets live. */
export function isPhoneLike(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);
}

export async function shareOut(p: SharePayload): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: p.title, text: p.text, url: p.url, dialogTitle: p.dialogTitle });
      return "shared";
    } catch {
      return "cancelled"; // the sheet was dismissed
    }
  }

  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: p.title, text: p.text, url: p.url });
      return "shared";
    } catch (err) {
      // NotAllowedError: the tap was already spent (a confirm, a network
      // call), so the browser refused. Our own sheet needs no fresh tap.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) return "cancelled";
    }
  }

  if (presentSheet) {
    presentSheet(p);
    return "sheet";
  }
  try {
    await navigator.clipboard.writeText(shareMessage(p));
    return "copied";
  } catch {
    return "failed";
  }
}
