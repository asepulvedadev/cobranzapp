import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("public landing scope", () => {
  it("describes the released operational scope without promising financial receipts", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Seguimiento de cuotas");
    expect(html).toContain("Tres perfiles, una empresa");
    expect(html).toContain("Verificación compartida con consentimiento");
    expect(html).not.toContain("Comprobante generado");
    expect(html).not.toContain("Pagos, efectivo, transferencias");
    expect(html).not.toContain("Consulta personal del cliente");
  });
});
