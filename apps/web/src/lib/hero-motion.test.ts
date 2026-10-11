import { describe, expect, it } from "vitest";
import { heroMotionFrame, heroScrollProgress } from "./hero-motion";

describe("shared mobile and desktop hero motion", () => {
  it.each([
    [0, 0, 0, 0, 1],
    [1 / 3, 1, 13, 8, 1.34],
    [2 / 3, 2, -3, -1, 1.48],
    [1, 3, -18, -8, 1.36],
  ])("preserves the camera and scene at progress %s", (ratio, scene, x, y, scale) => {
    const result = heroMotionFrame(ratio);
    expect(result.scene).toBe(scene);
    expect(result.x).toBeCloseTo(x);
    expect(result.y).toBeCloseTo(y);
    expect(result.scale).toBeCloseTo(scale);
  });

  it("clamps entry, exit and invalid positions instead of indexing beyond the four scenes", () => {
    expect(heroMotionFrame(-1)).toEqual(heroMotionFrame(0));
    expect(heroMotionFrame(2)).toEqual(heroMotionFrame(1));
    expect(heroMotionFrame(Number.NaN)).toEqual(heroMotionFrame(0));
  });

  it("interpolates continuously across camera segments", () => {
    for (const boundary of [1 / 3, 2 / 3]) {
      const before = heroMotionFrame(boundary - 0.00001);
      const after = heroMotionFrame(boundary + 0.00001);
      expect(before.x).toBeCloseTo(after.x, 4);
      expect(before.y).toBeCloseTo(after.y, 4);
      expect(before.scale).toBeCloseTo(after.scale, 4);
    }
  });

  it("uses the actual sticky frame for phone and desktop scroll distances", () => {
    expect(heroScrollProgress(-1120, 3040, 800)).toBe(0.5);
    expect(heroScrollProgress(-1900, 4800, 1000)).toBe(0.5);
    expect(heroScrollProgress(80, 3040, 800)).toBe(0);
    expect(heroScrollProgress(-5000, 3040, 800)).toBe(1);
    expect(heroScrollProgress(0, 0, 0)).toBe(0);
  });
});
