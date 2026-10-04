import { describe, expect, it } from "vitest";
import { safeColor } from "./color";

describe("safeColor", () => {
  it("passes plain six-digit hex colours through", () => {
    expect(safeColor("#6f53f5")).toBe("#6f53f5");
    expect(safeColor("#ABCDEF")).toBe("#ABCDEF");
  });

  it("refuses anything that could add CSS to a style attribute", () => {
    expect(safeColor("red;position:fixed;inset:0")).toBe("#6f53f5");
    expect(safeColor("#6f53f5;background:url(x)")).toBe("#6f53f5");
    expect(safeColor("url(https://example.com/x.png)", "#94a3b8")).toBe("#94a3b8");
  });

  it("refuses other colour shapes and non-strings", () => {
    expect(safeColor("#fff")).toBe("#6f53f5");
    expect(safeColor("rgb(0,0,0)")).toBe("#6f53f5");
    expect(safeColor(null)).toBe("#6f53f5");
    expect(safeColor(undefined, "#94a3b8")).toBe("#94a3b8");
  });
});
