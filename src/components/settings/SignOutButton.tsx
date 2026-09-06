"use client";

import { confirmSheet } from "@/components/app/ConfirmSheet";

// Sign out with a confirmation so an accidental tap doesn't drop your session.
// Keeps the plain form POST to /auth/signout; it just gates the submit.
export function SignOutButton() {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={(e) => {
        // Hold the submit, ask, then submit natively so this handler does
        // not run a second time.
        e.preventDefault();
        const form = e.currentTarget;
        void confirmSheet({ title: "Sign out of HouseSync?", confirmLabel: "Sign out" }).then((ok) => {
          if (ok) form.submit();
        });
      }}
    >
      <button type="submit" className="btn-secondary btn-block">
        Sign out
      </button>
    </form>
  );
}
