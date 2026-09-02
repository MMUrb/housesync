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
