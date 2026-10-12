import { describe, expect, it } from "vitest";
import {
  calculateMembershipMonthlyPrice,
  formatCop,
  membershipContactHref,
  membershipExtraEmployeePriceCop,
  membershipFeatures,
  membershipSetupFeeCop,
  memberships,
} from "./memberships";

describe("approved membership catalog", () => {
  it("defines exactly Pro and Ultra with the confirmed monthly prices and included seats", () => {
    expect(
      memberships.map((plan) => [
        plan.name,
        plan.monthlyPriceCop,
        plan.includedEmployeeSeats,
        plan.clientLimit,
      ]),
    ).toEqual([
      ["Pro", 150_000, 5, 100],
      ["Ultra", 300_000, 50, 200],
    ]);
  });

  it.each([
    ["pro", 0, 150_000],
    ["pro", 5, 150_000],
    ["pro", 6, 170_000],
    ["pro", 7, 190_000],
    ["pro", 8, 210_000],
    ["ultra", 50, 300_000],
    ["ultra", 51, 320_000],
    ["ultra", 52, 340_000],
  ] as const)(
    "prices %s with %i employees at COP %i, excluding the owner and setup",
    (plan, employees, total) => {
      expect(membershipExtraEmployeePriceCop).toBe(20_000);
      expect(calculateMembershipMonthlyPrice(plan, employees)).toBe(total);
    },
  );

  it.each([-1, 5.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
    "rejects invalid or unsupported employee count %s",
    (count) => expect(() => calculateMembershipMonthlyPrice("pro", count)).toThrow(RangeError),
  );

  it("reserves an additional owner seat and unlimited loans in both plans", () => {
    expect(memberships.map((plan) => plan.includedEmployeeSeats + plan.ownerSeats)).toEqual([
      6, 51,
    ]);
    expect(memberships.every((plan) => plan.loanLimit === null)).toBe(true);
  });

  it("separates the one-time fee from recurring membership and only Ultra has priority support", () => {
    expect(membershipSetupFeeCop).toBe(150_000);
    expect(memberships.map((plan) => plan.monthlyPriceCop + membershipSetupFeeCop)).toEqual([
      300_000, 450_000,
    ]);
    expect(memberships.map((plan) => plan.prioritySupport)).toEqual([false, true]);
  });

  it("shares all core features without exposing internal ratings in the customer-link copy", () => {
    expect(membershipFeatures).toHaveLength(8);
    expect(new Set(membershipFeatures.map((feature) => feature.id)).size).toBe(8);
    expect(membershipFeatures.find((feature) => feature.id === "customer-link")?.detail).toContain(
      "sin datos internos",
    );
    expect(membershipFeatures.find((feature) => feature.id === "business-rules")?.detail).toContain(
      "El dueño controla los porcentajes",
    );
    expect(membershipFeatures.find((feature) => feature.id === "loan-approval")?.detail).toContain(
      "supervisor o el dueño",
    );
  });

  it("formats Colombian pesos and routes each plan enquiry to the quick contact form", () => {
    expect(formatCop(150_000)).toBe("$150.000");
    expect(formatCop(300_000)).toBe("$300.000");
    for (const plan of memberships) {
      const link = new URL(membershipContactHref(plan.name), "https://cobranzaap.tech");
      expect(link.protocol).toBe("https:");
      expect(link.pathname).toBe("/contacto");
      expect(link.searchParams.get("plan")).toBe(plan.name);
      expect(link.searchParams.get("source")).toBe("planes");
    }
  });
});
