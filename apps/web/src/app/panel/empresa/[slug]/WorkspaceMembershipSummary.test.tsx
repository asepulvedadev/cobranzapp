import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TenantOverview } from "../../../../lib/platform";
import { WorkspaceMembershipSummary } from "./WorkspaceMembershipSummary";

const overview = {
  tenant: { membershipPlan: "pro" },
  metrics: { activeEmployeeSeats: 2, branches: 0 },
  settings: { contactEmail: "operaciones@example.com" },
} as TenantOverview;

describe("WorkspaceMembershipSummary", () => {
  it("shows commercial capacity without presenting invitations as automatic billing", () => {
    const html = renderToStaticMarkup(<WorkspaceMembershipSummary overview={overview} />);

    expect(html).toContain("Plan Pro");
    expect(html).toContain("2 de 5 incluidos");
    expect(html).toContain("Hasta 100");
    expect(html).toContain("3/4");
    expect(html).toContain("Las invitaciones no generan cobros automáticos");
  });

  it("renders an explicit pending state when a legacy tenant has no assigned plan", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMembershipSummary
        overview={{ ...overview, tenant: { ...overview.tenant, membershipPlan: null } }}
      />,
    );

    expect(html).toContain("Plan pendiente");
    expect(html).toContain("2/4");
  });
});
