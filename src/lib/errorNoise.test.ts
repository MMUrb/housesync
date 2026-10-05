import { describe, expect, it } from "vitest";
import { isOpaqueScriptError } from "./errorNoise";

describe("isOpaqueScriptError", () => {
  it("drops the browser's detail-free cross-origin report", () => {
    // Exactly what Snapchat's in-app browser sent on 05/10/2026.
    expect(isOpaqueScriptError("Script error.")).toBe(true);
    expect(isOpaqueScriptError("Script error.", null)).toBe(true);
    expect(isOpaqueScriptError("  Script error  ")).toBe(true);
  });

  it("keeps anything that carries real information", () => {
    // A stack means the details weren't hidden: it's diagnosable, keep it.
    expect(isOpaqueScriptError("Script error.", "at foo (app.js:1:2)")).toBe(false);
    // Real errors that merely mention scripts are not the opaque one.
    expect(isOpaqueScriptError("Script error: x is undefined")).toBe(false);
    expect(isOpaqueScriptError("TypeError: Load failed")).toBe(false);
  });
});
