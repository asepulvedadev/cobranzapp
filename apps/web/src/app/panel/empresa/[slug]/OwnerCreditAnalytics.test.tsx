import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OwnerCreditAnalytics } from "./OwnerCreditAnalytics";

describe("OwnerCreditAnalytics", () => {
  it("shows current portfolio, filtered collections and staff renewals", () => {
    const html = renderToStaticMarkup(
      <OwnerCreditAnalytics
        initialAnalytics={{
          period: { from: "2026-10-01", to: "2026-10-16", preset: "month" },
          metrics: {
            activePrincipalOutstanding: "850000.00",
            approvedPrincipal: "1200000.00",
            collectedAmount: "350000.00",
            renewalCount: 3,
            activeCreditCount: 8,
          },
          renewalsByMember: [
            {
              userId: "8b8f4a23-3207-497f-a4b6-778cb8f4d1d0",
              displayName: "Cobrador Uno",
              role: "collector",
              total: 3,
              pending: 1,
              activated: 2,
            },
          ],
        }}
        tenantId="5c58269f-ce16-4250-82e2-c0c16621b0fb"
        today="2026-10-16"
      />,
    );
    expect(html).toContain("Cartera vigente");
    expect(html).toContain("Recaudado");
    expect(html).toContain("Renovaciones por cobrador y supervisor");
    expect(html).toContain("Cobrador Uno");
  });
});
