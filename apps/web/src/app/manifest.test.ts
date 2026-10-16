import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA manifest icons", () => {
  it("publishes the versioned install icons", () => {
    const icons = manifest().icons ?? [];
    expect(icons.map((icon) => icon.src)).toEqual([
      "/pwa/icon-192-v2.png",
      "/pwa/icon-512-v2.png",
      "/pwa/icon-maskable-512-v2.png",
    ]);
    for (const icon of icons) {
      expect(existsSync(path.join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });
});
