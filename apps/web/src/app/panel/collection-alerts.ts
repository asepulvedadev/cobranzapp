import type { LoanApplication, TenantOverview } from "../../lib/platform";

export type CollectionAlert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

type StaffRole = "owner" | "supervisor" | "collector";

function installmentLabel(total: number) {
  return total === 1 ? "cuota vencida" : "cuotas vencidas";
}

export function buildCollectionAlerts({
  applications,
  basePath,
  metrics,
  role,
  today,
}: {
  applications: LoanApplication[];
  basePath: string;
  metrics: TenantOverview["metrics"] & { pendingIdentities?: number };
  role: StaffRole;
  today: string;
}): CollectionAlert[] {
  const alerts: CollectionAlert[] = [];

  for (const application of applications) {
    if (application.status !== "active") continue;
    const overdue = application.overdueInstallments ?? 0;
    if (overdue > 0) {
      alerts.push({
        id: `overdue:${application.id}:${overdue}`,
        title: `${application.borrowerName}: ${overdue} ${installmentLabel(overdue)}`,
        detail: `La cuota ${application.paidInstallments + 1} necesita gestión inmediata.`,
        href: `${basePath}/creditos?cobros=vencidos`,
        severity: "critical",
      });
      continue;
    }
    if (application.nextDueDate === today) {
      alerts.push({
        id: `due:${application.id}:${today}`,
        title: `${application.borrowerName}: cobro de hoy`,
        detail: `Corresponde la cuota ${application.paidInstallments + 1} de ${application.requestedTermCount}.`,
        href: `${basePath}/creditos?cobros=hoy`,
        severity: "warning",
      });
    }
  }

  if (role !== "collector") {
    const approvals = applications.filter((application) =>
      ["submitted", "under_review"].includes(application.status),
    ).length;
    if (approvals > 0) {
      alerts.push({
        id: `approvals:${approvals}`,
        title: `${approvals} ${approvals === 1 ? "crédito espera" : "créditos esperan"} aprobación`,
        detail: "Revisa monto, interés y trazabilidad antes de activar.",
        href: `${basePath}/creditos?cobros=por-aprobar`,
        severity: "warning",
      });
    }

    const pendingIdentities = metrics.pendingIdentities ?? 0;
    if (pendingIdentities > 0) {
      alerts.push({
        id: `identities:${pendingIdentities}`,
        title: `${pendingIdentities} ${pendingIdentities === 1 ? "cliente necesita" : "clientes necesitan"} aprobación`,
        detail: "Verifica la cédula y la selfie para continuar.",
        href: `${basePath}/clientes`,
        severity: "info",
      });
    }
  }

  if (role === "collector" && (metrics.postponedCollections ?? 0) > 0) {
    const postponed = metrics.postponedCollections ?? 0;
    alerts.push({
      id: `postponed:${postponed}`,
      title: `${postponed} ${postponed === 1 ? "cobro aplazado" : "cobros aplazados"}`,
      detail: "Revisa la nueva fecha prometida por el cliente.",
      href: `${basePath}/clientes`,
      severity: "info",
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((left, right) => order[left.severity] - order[right.severity]).slice(0, 20);
}
