import { describe, it, expect } from "vitest";
import { channelOf } from "./signupChannel";

describe("channelOf", () => {
  it("trusts an exact stamp over every other signal", () => {
    expect(channelOf({ signup_platform: "web", provider: "apple" }, new Set(["ios"]))).toEqual({
      channel: "web",
      exact: true,
    });
  });

  it("estimates iOS app from Apple sign-in", () => {
    expect(channelOf({ provider: "apple" }, undefined)).toEqual({
      channel: "ios-app",
      exact: false,
    });
  });

  it("estimates from a native push token's platform", () => {
    expect(channelOf({ provider: "google" }, new Set(["android"]))).toEqual({
      channel: "android-app",
      exact: false,
    });
    expect(channelOf({ provider: "email" }, new Set(["ios"]))).toEqual({
      channel: "ios-app",
      exact: false,
    });
  });

  it("assumes web (marked inexact) when no app signal exists", () => {
    expect(channelOf({ provider: "email" }, undefined)).toEqual({
      channel: "web",
      exact: false,
    });
  });

  it("ignores an unrecognised stamp value", () => {
    expect(channelOf({ signup_platform: "toaster", provider: "apple" }, undefined)).toEqual({
      channel: "ios-app",
      exact: false,
    });
  });
});
