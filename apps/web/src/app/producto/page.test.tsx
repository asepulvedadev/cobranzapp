import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProductPage from "./page";

describe("public product scope", () => {
  it("describes operational modules and roles without unsupported financial claims", () => {
    const html = renderToStaticMarkup(<ProductPage />);

    expect(html).toContain("Clientes y créditos operativos");
    expect(html).toContain("Verificación compartida");
    expect(html).toContain("Documentos y OCR asistivo");
    expect(html).toContain("Propietario");
    expect(html).toContain("Supervisor");
    expect(html).toContain("Cobrador");
    expect(html).not.toContain("Comprobantes");
    expect(html).not.toContain("Cierre y conciliación");
    expect(html).not.toContain("Consulta del cliente");
    expect(html).not.toContain(">Cliente</th>");
  });
});
