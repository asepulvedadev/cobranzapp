import { describe, expect, it } from "vitest";
import { LoginRateLimiter } from "./login-rate-limiter.js";

describe("LoginRateLimiter", () => {
  it("blocks after the configured number of failures", () => {
    const limiter = new LoginRateLimiter(2, 1_000);
    limiter.registerFailure("client", 100);
    expect(limiter.isBlocked("client", 100)).toBe(false);
    limiter.registerFailure("client", 100);
    expect(limiter.isBlocked("client", 100)).toBe(true);
  });

  it("expires attempts after the window", () => {
    const limiter = new LoginRateLimiter(1, 1_000);
    limiter.registerFailure("client", 100);
    expect(limiter.isBlocked("client", 1_101)).toBe(false);
  });
});
