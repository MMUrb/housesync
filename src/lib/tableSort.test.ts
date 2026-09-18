import { describe, it, expect } from "vitest";
import { nextSortDir } from "./tableSort";

describe("nextSortDir", () => {
  it("opens date columns on the newest first, then the earliest", () => {
    // First click from some other column.
    expect(nextSortDir({ key: "name", dir: "asc" }, "joined")).toBe("desc");
    expect(nextSortDir({ key: "name", dir: "asc" }, "seen")).toBe("desc");
    expect(nextSortDir({ key: "house", dir: "asc" }, "created")).toBe("desc");
    // Second click on the same column flips to earliest.
    expect(nextSortDir({ key: "joined", dir: "desc" }, "joined")).toBe("asc");
    expect(nextSortDir({ key: "seen", dir: "desc" }, "seen")).toBe("asc");
  });

  it("opens text columns A to Z, the opposite way round", () => {
    expect(nextSortDir({ key: "joined", dir: "desc" }, "name")).toBe("asc");
    expect(nextSortDir({ key: "joined", dir: "desc" }, "email")).toBe("asc");
    expect(nextSortDir({ key: "joined", dir: "desc" }, "household")).toBe("asc");
    expect(nextSortDir({ key: "name", dir: "asc" }, "name")).toBe("desc");
  });

  it("keeps flipping on repeated clicks rather than sticking", () => {
    let s = { key: "seen", dir: nextSortDir({ key: "name", dir: "asc" }, "seen") };
    expect(s.dir).toBe("desc");
    s = { key: "seen", dir: nextSortDir(s, "seen") };
    expect(s.dir).toBe("asc");
    s = { key: "seen", dir: nextSortDir(s, "seen") };
    expect(s.dir).toBe("desc");
  });
});
