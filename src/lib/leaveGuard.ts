"use client";

// Tiny client-side guard so we can warn before navigating away from a
// half-filled form (account sign-up or house creation). Forms call
// setLeaveGuard(true/false); links call confirmLeave() before navigating.

let dirty = false;

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}

export function setLeaveGuard(next: boolean) {
  dirty = next;
  if (typeof window === "undefined") return;
  // Idempotent: always detach, then attach only when dirty.
  window.removeEventListener("beforeunload", onBeforeUnload);
  if (next) window.addEventListener("beforeunload", onBeforeUnload);
}

/** True if it's safe to leave — the form is clean, or the user confirmed. */
export function confirmLeave(
  message = "Leave this page? Anything you've entered will be lost.",
): boolean {
  if (!dirty) return true;
  const ok = window.confirm(message);
  if (ok) setLeaveGuard(false);
  return ok;
}
