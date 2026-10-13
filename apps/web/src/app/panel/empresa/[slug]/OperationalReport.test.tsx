import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LoanApplication } from "../../../../lib/platform";
import { OperationalReport } from "./OperationalReport";

const application = {
  id: "03d87dd0-dfc6-4948-bef1-a04f06b61ca6",
  borrowerId: "13d87dd0-dfc6-4948-bef1-a04f06b61ca6",
  borrowerName: "Cliente Ejemplo",
  loanProductId: "23d87dd0-dfc6-4948-bef1-a04f06b61ca6",
  loanProductName: "Crédito diario",
  requestedPrincipal: "100000.00",
  paymentFrequency: "daily",
  requestedTermCount: 30,
  paidInstallments: 3,
  nextDueDate: "2026-01-10",
  overdueInstallments: 2,
  purpose: null,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-08T00:00:00.000Z",
} as LoanApplication;

describe("OperationalReport", () => {
  it("prioritizes overdue operational credits without presenting balances", () => {
    const html = renderToStaticMarkup(<OperationalReport applications={[application]} />);

    expect(html).toContain("Cuotas vencidas");
    expect(html).toContain("Cliente Ejemplo");
    expect(html).toContain("2 vencida(s)");
    expect(html).toContain("Proyección operativa, no saldo contable");
  });

  it("explains the empty operational state", () => {
    const html = renderToStaticMarkup(<OperationalReport applications={[]} />);

    expect(html).toContain("Todavía no hay créditos activos para analizar");
    expect(html).toContain("No hay cuotas vencidas");
  });
});
