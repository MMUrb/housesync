"use client";

import { forgetThisDevice } from "@/lib/forgetDevice";

/** A plain sign-out link (no confirm) that tidies this device first. */
export function SignOutLink({ label }: { label: string }) {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        void forgetThisDevice({ stillSignedIn: true }).then(() => form.submit());
      }}
    >
      <button type="submit" className="font-medium text-brand-600 hover:underline">
        {label}
      </button>
    </form>
  );
}
