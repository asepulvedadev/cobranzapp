import { describe, expect, it } from "vitest";
import type { LoanApplication, TenantOverview } from "../../lib/platform";
import { buildCollectionAlerts } from "./collection-alerts";

const application = {
  id: "24c413bf-d371-4f7f-93f6-b23f0c770044",
  borrowerId: "3a688b91-b98b-433c-9cb1-c055eed0065d",
  borrowerName: "Laura Pérez",
  loanProductId: "80bb1894-785f-4278-b918-56c4fcd46e61",
  loanProductName: "Diario",
  requestedPrincipal: "300000.00",
  requestedTermCount: 30,
  paidInstallments: 5,
  paymentFrequency: "daily",
  purpose: null,
  rateBasis: "flat_total",
  nominalRate: "20.00",
  documentationFeeRate: "0.00",
  interestTotal: "60000.00",
  installmentAmount: "12000.00",
  nextPaymentAmount: "12000.00",
  scheduledTotal: "360000.00",
  remainingAmount: "300000.00",
  status: "active",
  createdAt: "2026-10-10T12:00:00.000Z",
  updatedAt: "2026-10-10T12:00:00.000Z",
} satisfies LoanApplication;

const metrics = {
  members: 2,
  branches: 0,
  teams: 0,
  pendingInvitations: 0,
  activeEmployeeSeats: 1,
} satisfies TenantOverview["metrics"];

describe("buildCollectionAlerts", () => {
  it("prioritizes unpaid installments over today's collection reminder", () => {
    const alerts = buildCollectionAlerts({
      applications: [{ ...application, nextDueDate: "2026-10-19", overdueInstallments: 2 }],
      basePath: "/panel/empresa/demo",
      metrics,
      role: "collector",
      today: "2026-10-19",
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      severity: "critical",
      title: "Laura Pérez: 2 cuotas vencidas",
    });
  });

  it("adds role-specific approval and identity alerts for supervisors", () => {
    const alerts = buildCollectionAlerts({
      applications: [{ ...application, status: "submitted" }],
      basePath: "/panel/empresa/demo",
      metrics: { ...metrics, pendingIdentities: 3 },
      role: "supervisor",
      today: "2026-10-19",
    });

    expect(alerts.map((alert) => alert.id)).toEqual(["approvals:1", "identities:3"]);
  });
});
