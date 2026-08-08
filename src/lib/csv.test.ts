import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv";

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
