import { describe, expect, it } from "vitest";
import { isUnexpectedAuthFailure } from "./authFailure";

/** Shaped like supabase-js auth errors: an Error with a numeric status. */
const authError = (message: string, status?: number) => Object.assign(new Error(message), { status });

describe("isUnexpectedAuthFailure", () => {
  it("reports server and database faults: only we can fix those", () => {
    expect(isUnexpectedAuthFailure(authError("Error sending recovery email", 500))).toBe(true);
    expect(isUnexpectedAuthFailure(authError("Database error saving new user", 500))).toBe(true);
    expect(isUnexpectedAuthFailure(authError("Unexpected failure, please check server logs", 500))).toBe(true);
    // A database fault can surface without a 5xx status too.
    expect(isUnexpectedAuthFailure(authError('null value in column "x" violates not-null constraint'))).toBe(true);
  });

  it("never reports the person's own mistakes or deliberate no's", () => {
    expect(isUnexpectedAuthFailure(authError("Invalid login credentials", 400))).toBe(false);
    expect(isUnexpectedAuthFailure(authError("User already registered", 422))).toBe(false);
    expect(isUnexpectedAuthFailure(authError("New password should be different from the old password.", 422))).toBe(false);
    expect(isUnexpectedAuthFailure(authError("Password should be at least 6 characters.", 422))).toBe(false);
    expect(isUnexpectedAuthFailure(authError("Auth session missing!", 400))).toBe(false);
    expect(isUnexpectedAuthFailure(authError("For security purposes, you can only request this after 42 seconds.", 429))).toBe(false);
  });

  it("doesn't report a dropped connection, which the person can retry", () => {
    expect(isUnexpectedAuthFailure(authError("Load failed", 0))).toBe(false);
    expect(isUnexpectedAuthFailure(authError("Failed to fetch"))).toBe(false);
    expect(isUnexpectedAuthFailure(null)).toBe(false);
  });
});
