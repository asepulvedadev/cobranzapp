import { describe, expect, it } from "vitest";
import { isAppleMobileDevice, isSafariOnIos } from "./InstallAppButton";

describe("iOS PWA installation detection", () => {
  it("detects iPhone and iPadOS devices", () => {
    expect(isAppleMobileDevice("Mozilla/5.0 (iPhone)", "iPhone", 5)).toBe(true);
    expect(isAppleMobileDevice("Mozilla/5.0 (Macintosh)", "MacIntel", 5)).toBe(true);
    expect(isAppleMobileDevice("Mozilla/5.0 (Macintosh)", "MacIntel", 0)).toBe(false);
  });

  it("distinguishes Safari from other iOS browsers", () => {
    expect(
      isSafariOnIos(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
    expect(
      isSafariOnIos(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/128.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });
});
