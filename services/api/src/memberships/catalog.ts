import type { MembershipEntitlement, MembershipPlan } from "@cobranzapp/contracts";

export type { MembershipEntitlement, MembershipPlan } from "@cobranzapp/contracts";

export const membershipCatalogVersion = 1;
export const membershipMonthlyPriceCop: Record<MembershipPlan, number> = {
  pro: 150_000,
  ultra: 300_000,
};
export const membershipExtraEmployeePriceCop = 20_000;

export const membershipCatalog: Record<
  MembershipPlan,
  Pick<MembershipEntitlement, "includedEmployeeSeats" | "clientLimit" | "prioritySupport">
> = {
  pro: { includedEmployeeSeats: 5, clientLimit: 100, prioritySupport: false },
  ultra: { includedEmployeeSeats: 50, clientLimit: 200, prioritySupport: true },
};

export function buildMembershipEntitlement(
  plan: MembershipPlan,
  additionalEmployeeSeats: number,
  version: number,
): MembershipEntitlement {
  const catalog = membershipCatalog[plan];
  return {
    catalogVersion: membershipCatalogVersion,
    version,
    ...catalog,
    additionalEmployeeSeats,
    employeeSeatLimit: catalog.includedEmployeeSeats + additionalEmployeeSeats,
  };
}
