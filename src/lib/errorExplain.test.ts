import { describe, it, expect } from "vitest";
import { explainError } from "./errorExplain";

// Real messages from the production error log, plus the fallbacks.
describe("explainError", () => {
  it("recognises React hydration failures", () => {
    const e = explainError(
      "Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message",
      "client",
    );
    expect(e.what).toContain("didn't match");
  });

  it("recognises WebKit network deaths", () => {
    const e = explainError("Chat mark-read failed: TypeError: Load failed", "client");
    expect(e.what).toContain("network request died");
  });

  it("recognises database refusals", () => {
    const e = explainError("PGRST116: JSON object requested, multiple rows returned", "server");
    expect(e.what).toContain("database refused");
  });

  it("explains a store sync stopped by an unaccepted Apple agreement", () => {
    const e = explainError(
      "Store sync: iOS: Apple needs the Account Holder to accept an updated agreement at developer.apple.com/account",
      "server",
    );
    expect(e.what).toContain("updated agreement");
    expect(e.cause).toContain("developer.apple.com/account");
  });

  it("explains any other store sync failure", () => {
    const e = explainError("Store sync: Android: Play CSV 202610: 403 Forbidden", "server");
    expect(e.what).toContain("couldn't get data");
  });

  it("explains the opaque Script error from in-app browsers", () => {
    const e = explainError("Script error.", "client");
    expect(e.what).toContain("isn't HouseSync's");
    expect(e.cause).toContain("in-app browser");
  });

  it("explains a failed save, even when it was the connection", () => {
    const refused = explainError(
      'Save failed: expenses (insert): 403 42501: new row violates row-level security policy for table "expenses"',
      "client",
    );
    expect(refused.what).toContain("didn't go through");
    // Must win over the generic connection rule, which also matches "Load failed".
    const dropped = explainError("Save failed: chores (update): connection dropped (Load failed)", "client");
    expect(dropped.what).toContain("didn't go through");
    expect(dropped.cause).toContain("signal");
  });

  it("recognises missing-value bugs", () => {
    const e = explainError(
      "TypeError: Cannot read properties of undefined (reading 'split')",
      "client",
    );
    expect(e.what).toContain("genuine bug");
  });

  it("falls back by source when nothing matches", () => {
    expect(explainError("something novel", "server").what).toContain("server code");
    expect(explainError("something novel", "client").what).toContain("browser");
  });
});
