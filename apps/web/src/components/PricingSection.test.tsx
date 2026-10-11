import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { membershipFeatures } from "../data/memberships";
import { PricingSection } from "./PricingSection";

describe("membership landing presentation", () => {
  it("renders both memberships, capacities and shared inclusions without client-side JavaScript", () => {
    const html = renderToStaticMarkup(<PricingSection />);
    expect(html).toContain('id="planes"');
    expect(html.match(/<article /g)).toHaveLength(2);
    expect(html).toContain("$150.000");
    expect(html).toContain("$300.000");
    expect(html).toContain("6 usuarios incluidos en total");
    expect(html).toContain("51 usuarios incluidos en total");
    for (const card of html.match(/<article .*?<\/article>/g) ?? []) {
      for (const feature of membershipFeatures) expect(card).toContain(feature.label);
      expect(card).toContain("Ilimitados");
      expect(card).toContain("una sola vez");
      expect(card).toContain("$20.000");
      expect(card).toContain("por usuario adicional del equipo / mes");
      expect(card).not.toMatch(/Hasta (5|50)<\/dd>/);
    }
  });

  it("exposes separate onboarding, private-rating boundary and per-plan enquiry links", () => {
    const html = renderToStaticMarkup(<PricingSection />);
    expect(html).toContain("pago único");
    expect(html).toContain("Se cobra aparte de la mensualidad");
    expect(html).toContain("nunca al enlace del cliente");
    expect(html).toContain("El dueño controla los porcentajes");
    expect(html).toContain("supervisor o el dueño autoriza");
    expect(html).toContain(
      "mailto:info@cobranzaap.tech?subject=Informaci%C3%B3n%20del%20plan%20Pro",
    );
    expect(html).toContain(
      "mailto:info@cobranzaap.tech?subject=Informaci%C3%B3n%20del%20plan%20Ultra",
    );
    expect(html).not.toContain("La plataforma y las funciones operativas están en desarrollo");
    expect(html).not.toContain("La contratación y el onboarding se coordinan con el equipo");
    expect(html).not.toContain("El comprobante diario no se presenta como facturación electrónica");
  });
});
