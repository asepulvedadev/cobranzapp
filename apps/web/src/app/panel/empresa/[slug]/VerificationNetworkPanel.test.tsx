import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientVerificationSearch } from "./VerificationNetworkPanel";

describe("ClientVerificationSearch", () => {
  it("presents the document lookup in a clear accessible order", () => {
    const html = renderToStaticMarkup(<ClientVerificationSearch tenantId="tenant-1" />);

    expect(html).toContain('for="verification-document-number"');
    expect(html).toContain('id="verification-document-number"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain("Solo números, sin puntos ni espacios.");
    expect(html).toContain("Consulta autorizada");
    expect(html).toContain("Verificar cliente");
  });

  it("offers managers a minimal risk registry without asking for invented client data", () => {
    const html = renderToStaticMarkup(
      <ClientVerificationSearch canManageRiskRegistry tenantId="tenant-1" />,
    );

    expect(html).toContain("Registrar una cédula");
    expect(html).toContain("Agregar alerta");
    expect(html).toContain("No necesitas crear un cliente ni inventar datos faltantes.");
  });
});
