export type MembershipPlan = "pro" | "ultra";

export type MembershipEntitlement = {
  catalogVersion: number;
  version: number;
  includedEmployeeSeats: number;
  additionalEmployeeSeats: number;
  employeeSeatLimit: number;
  clientLimit: number;
  prioritySupport: boolean;
};

export const membershipCatalogVersion = 1;

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
