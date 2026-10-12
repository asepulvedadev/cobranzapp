import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TenantReadiness } from "./TenantReadiness";

describe("TenantReadiness", () => {
  it("includes the commercial plan in the activation requirements", () => {
    const html = renderToStaticMarkup(
      <TenantReadiness
        readiness={{
          activeOwner: true,
          activeBranch: true,
          contactEmail: true,
          membershipPlan: true,
        }}
      />,
    );

    expect(html).toContain("Preparación de la empresa: 4 de 4 requisitos");
    expect(html).toContain("Plan");
    expect(html).toContain("Lista");
  });
});
