import { describe, expect, it } from "vitest";
import { shouldReloadForRelease } from "./ServiceWorkerRegistration";

describe("installed app release updates", () => {
  it("reloads only when a previous release differs from the current one", () => {
    expect(shouldReloadForRelease(null, "release-b")).toBe(false);
    expect(shouldReloadForRelease("release-b", "release-b")).toBe(false);
    expect(shouldReloadForRelease("release-a", "release-b")).toBe(true);
  });
});
