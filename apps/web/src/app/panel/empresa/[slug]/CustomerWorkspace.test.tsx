import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TenantOverview } from "../../../../lib/platform";
import { CustomerWorkspace } from "./CustomerWorkspace";

const overview: TenantOverview = {
  tenant: {
    id: "4cde1a7b-46d3-4405-914f-6e4b9aeed985",
    slug: "empresa-uno",
    displayName: "Empresa Uno",
    status: "active",
    locale: "es-CO",
    timezone: "America/Bogota",
    currency: "COP",
    membershipPlan: "pro",
  },
  actorRole: "customer",
  metrics: {
    members: 0,
    branches: 0,
    teams: 0,
    pendingInvitations: 0,
    activeEmployeeSeats: 0,
  },
  settings: {
    primaryColor: "#171717",
    accentColor: "#FBBF24",
    contactEmail: "contacto@example.com",
    contactPhone: "+57 300 000 0000",
    address: "Cúcuta, Colombia",
    version: 1,
  },
  settingsHistory: [],
  members: [],
  branches: [],
  teams: [],
  pendingInvitations: [],
  activity: [],
};

describe("CustomerWorkspace", () => {
  it("shows the personal boundary without internal organization data", () => {
    const html = renderToStaticMarkup(<CustomerWorkspace overview={overview} />);

    expect(html).toContain("Tu acceso está separado de la operación interna.");
    expect(html).toContain("contacto@example.com");
    expect(html).not.toContain("Integrantes activos");
    expect(html).not.toContain("Sedes y equipos");
    expect(html).not.toContain("Actividad reciente");
  });
});
