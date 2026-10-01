import { describe, expect, it } from "vitest";
import { clientIp } from "./clientIp";

const req = (headers: Record<string, string>) => new Request("https://housesync.co.uk/api/x", { headers });

describe("clientIp", () => {
  it("trusts the address Vercel sets, not the client's own header", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(req({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "6.6.6.6" }))).toBe(
      "203.0.113.9",
    );
  });

  it("a spoofed left-hand entry can't pick the key", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("falls back to unknown", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
