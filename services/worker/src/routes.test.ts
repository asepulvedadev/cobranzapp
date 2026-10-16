import { describe, expect, it } from "vitest";
import { routeServiceDate, shouldCreateAutomaticRoute } from "./routes.js";

describe("automatic route schedule", () => {
  it("waits until 05:00 in the tenant timezone and plans the next local day", () => {
    expect(routeServiceDate(new Date("2026-10-16T09:59:59.000Z"), "America/Bogota")).toBeNull();
    expect(routeServiceDate(new Date("2026-10-16T10:00:00.000Z"), "America/Bogota")).toBe(
      "2026-10-17",
    );
  });

  it("uses each tenant timezone instead of the server timezone", () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    expect(routeServiceDate(now, "America/Bogota")).toBe("2026-10-17");
    expect(routeServiceDate(now, "Pacific/Honolulu")).toBeNull();
  });

  it("creates a route only when the collector has at least two due clients", () => {
    expect(shouldCreateAutomaticRoute(0)).toBe(false);
    expect(shouldCreateAutomaticRoute(1)).toBe(false);
    expect(shouldCreateAutomaticRoute(2)).toBe(true);
  });
});
