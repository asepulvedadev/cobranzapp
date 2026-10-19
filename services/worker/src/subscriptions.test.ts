import { describe, expect, it } from "vitest";
import { addBillingPeriod, nextCurrentPeriod, subscriptionServiceDate } from "./subscriptions.js";

describe("subscription lifecycle", () => {
  it("preserves calendar boundaries without overflowing short months", () => {
    expect(addBillingPeriod("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(addBillingPeriod("2024-02-29", "yearly")).toBe("2025-02-28");
  });

  it("advances every missed cycle and leaves the new end after the service date", () => {
    expect(nextCurrentPeriod("2026-01-31", "monthly", "2026-04-10")).toEqual({
      start: "2026-03-28",
      end: "2026-04-28",
      cycles: 3,
    });
  });

  it("uses the Colombian business date instead of the server UTC date", () => {
    expect(subscriptionServiceDate(new Date("2026-10-20T03:00:00.000Z"))).toBe("2026-10-19");
    expect(subscriptionServiceDate(new Date("2026-10-20T05:00:00.000Z"))).toBe("2026-10-20");
  });
});
