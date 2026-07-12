"use client";

// Sign out with a confirmation so an accidental tap doesn't drop your session.
// Keeps the plain form POST to /auth/signout; it just gates the submit.
export function SignOutButton() {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={(e) => {
        if (!confirm("Sign out of HouseSync?")) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-secondary btn-block">
        Sign out
      </button>
    </form>
  );
}
