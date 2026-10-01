import { describe, expect, it } from "vitest";
import { isPushServiceEndpoint } from "./pushEndpoint";

describe("isPushServiceEndpoint", () => {
  it("accepts the real push services", () => {
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc:def")).toBe(true);
    expect(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/gAAA")).toBe(true);
    expect(isPushServiceEndpoint("https://wns2-db5p.notify.windows.com/w/?token=BQYAAA")).toBe(true);
    expect(isPushServiceEndpoint("https://web.push.apple.com/QGuQyavXutnMH")).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isPushServiceEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPushServiceEndpoint("https://localhost:3000/api")).toBe(false);
    expect(isPushServiceEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com:8443/fcm/send/x")).toBe(false);
    expect(isPushServiceEndpoint("https://user:pw@fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("https://evilpush.services.mozilla.com.example/x")).toBe(false);
    expect(isPushServiceEndpoint("not a url")).toBe(false);
  });
});
