import { describe, expect, it } from "vitest";
import { APPLE_AGREEMENT_MESSAGE, describeAppleError } from "./storeErrors";

describe("describeAppleError", () => {
  it("turns the expired-agreement refusal into the action to take", () => {
    // Apple's actual body on 05/10/2026, which stopped every sync.
    const body = `{
"errors" : [ {
"id" : "ARJWLSWPKVT6ZR4BUJSJOWKGAQ",
"status" : "403",
"code" : "FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED",
"title" : "A required agreement is missing or has expired.",
"detail" : "This request requires an in-effect agreement that has not been signed or has expired."
} ]
}`;
    expect(describeAppleError(403, body)).toBe(APPLE_AGREEMENT_MESSAGE);
    // It must fit the Sync button's message in full.
    expect(APPLE_AGREEMENT_MESSAGE.length).toBeLessThanOrEqual(160);
  });

  it("names Apple's code and title for any other refusal", () => {
    const role = JSON.stringify({
      errors: [{ status: "403", code: "FORBIDDEN_ERROR", title: "The API key in use does not allow this request" }],
    });
    expect(describeAppleError(403, role)).toBe(
      "Apple 403 FORBIDDEN_ERROR: The API key in use does not allow this request",
    );
    const auth = JSON.stringify({
      errors: [{ status: "401", code: "NOT_AUTHORIZED", title: "Authentication credentials are missing or invalid." }],
    });
    expect(describeAppleError(401, auth)).toBe(
      "Apple 401 NOT_AUTHORIZED: Authentication credentials are missing or invalid.",
    );
  });

  it("copes with a body that isn't JSON, or is empty", () => {
    expect(describeAppleError(502, "Bad Gateway")).toBe("Apple 502: Bad Gateway");
    expect(describeAppleError(500, "")).toBe("Apple 500");
    expect(describeAppleError(500, "x".repeat(400)).length).toBeLessThan(140);
  });
});
