import { describe, it, expect } from "vitest";
import { csvCell, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas, escaped quotes and newlines inside quoted fields", () => {
    const csv = 'rating,text\n5,"Great app, honestly ""the best""\nwe tried"';
    expect(parseCsv(csv)).toEqual([
      ["rating", "text"],
      ["5", 'Great app, honestly "the best"\nwe tried'],
    ]);
  });

  it("handles CRLF endings, a BOM and a trailing newline", () => {
    expect(parseCsv('﻿a,b\r\n"x",y\r\n')).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
  });
});

describe("csvCell", () => {
  it("neutralises anything that would run as a formula", () => {
    expect(csvCell('=HYPERLINK("https://evil.example","Click")')).toBe(
      `"'=HYPERLINK(""https://evil.example"",""Click"")"`,
    );
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tTab")).toBe("'\tTab");
  });

  it("leaves numbers and ordinary text alone", () => {
    expect(csvCell("12.50")).toBe("12.50");
    expect(csvCell("-3.25")).toBe("-3.25");
    expect(csvCell("2026-10-01")).toBe("2026-10-01");
    expect(csvCell("Big shop")).toBe("Big shop");
    expect(csvCell(null)).toBe("");
  });

  it("still quotes delimiters", () => {
    expect(csvCell('Wine, "the good one"')).toBe('"Wine, ""the good one"""');
  });

  it("round-trips through the parser as the text a person sees", () => {
    expect(parseCsv(["Date", "=1+1", "Big, shop"].map(csvCell).join(","))).toEqual([
      ["Date", "'=1+1", "Big, shop"],
    ]);
  });
});
