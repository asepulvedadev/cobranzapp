/** User-approved commercial catalog. This is not backend entitlement enforcement. */
export const membershipSetupFeeCop = 150_000;
export const membershipExtraEmployeePriceCop = 20_000;

export const memberships = [
  {
    id: "pro",
    name: "Pro",
    monthlyPriceCop: 150_000,
    includedEmployeeSeats: 5,
    ownerSeats: 1,
    clientLimit: 100,
    loanLimit: null,
    prioritySupport: false,
    description: "Para controlar tu cartera con un equipo cercano.",
  },
  {
    id: "ultra",
    name: "Ultra",
    monthlyPriceCop: 300_000,
    includedEmployeeSeats: 50,
    ownerSeats: 1,
    clientLimit: 200,
    loanLimit: null,
    prioritySupport: true,
    description: "Más capacidad para tu operación y atención prioritaria.",
  },
] as const;

export type MembershipId = (typeof memberships)[number]["id"];

/** Commercial estimate: employees exclude the included owner; onboarding is not recurring. */
export function calculateMembershipMonthlyPrice(
  planId: MembershipId,
  employeeCount: number,
): number {
  const plan = memberships.find((membership) => membership.id === planId);
  if (!plan || !Number.isSafeInteger(employeeCount) || employeeCount < 0) {
    throw new RangeError(
      "A valid membership and non-negative integer employee count are required.",
    );
  }
  const extraEmployees = Math.max(0, employeeCount - plan.includedEmployeeSeats);
  const total = plan.monthlyPriceCop + extraEmployees * membershipExtraEmployeePriceCop;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("The monthly estimate exceeds the supported integer range.");
  }
  return total;
}

export const membershipFeatures = [
  {
    id: "risk-registry",
    label: "Verificación compartida con consentimiento",
    detail:
      "Consulta mínima y explicable de clientes, con autorización, corrección y acceso restringido.",
  },
  {
    id: "analytics",
    label: "Análisis en tiempo real",
    detail: "Cartera, recaudo y novedades sobre los movimientos confirmados en el sistema.",
  },
  {
    id: "routes",
    label: "Gestión de rutas",
    detail: "Organiza jornadas, responsables y puntos de gestión para tu equipo.",
  },
  {
    id: "daily-receipt",
    label: "Registro operativo diario por cliente",
    detail:
      "Consulta el avance de cuotas operativas y gestiones de la jornada; no es facturación ni recibo financiero.",
  },
  {
    id: "internal-profile",
    label: "Ficha actualizada y calificación interna",
    detail:
      "Información restringida al dueño y al personal autorizado; nunca al enlace del cliente.",
  },
  {
    id: "customer-link",
    label: "Ficha de cliente con acceso restringido",
    detail:
      "El equipo autorizado consulta la ficha y el historial operativo sin exponer datos internos.",
  },
  {
    id: "business-rules",
    label: "Reglas y valores del negocio configurables",
    detail:
      "El dueño controla los porcentajes. El equipo ingresa valores dentro de las reglas aprobadas.",
  },
  {
    id: "loan-approval",
    label: "Préstamos con autorización",
    detail: "El cobrador prepara la solicitud; un supervisor o el dueño autoriza el préstamo.",
  },
] as const;

export function formatCop(amount: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(amount)}`;
}

export function membershipContactHref(name: string): string {
  return `/contacto?plan=${encodeURIComponent(name)}&source=planes`;
}
