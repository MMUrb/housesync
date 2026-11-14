import { describe, expect, it } from "vitest";
import { checkUnsubscribeToken, makeUnsubscribeToken } from "./unsubscribeToken";

describe("unsubscribe links", () => {
  const secret = "test-secret";

  it("accepts the link sent to that person", () => {
    const t = makeUnsubscribeToken("user-1", secret);
    expect(checkUnsubscribeToken("user-1", t, secret)).toBe(true);
  });

  it("can't be reused to unsubscribe someone else", () => {
    const t = makeUnsubscribeToken("user-1", secret);
    expect(checkUnsubscribeToken("user-2", t, secret)).toBe(false);
  });

  it("rejects tampered, empty or unsecured tokens", () => {
    const t = makeUnsubscribeToken("user-1", secret);
    expect(checkUnsubscribeToken("user-1", `${t.slice(0, -1)}x`, secret)).toBe(false);
    expect(checkUnsubscribeToken("user-1", "", secret)).toBe(false);
    // No secret configured: fail closed.
    expect(checkUnsubscribeToken("user-1", t, "")).toBe(false);
  });
});
