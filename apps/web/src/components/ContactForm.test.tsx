import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContactForm } from "./ContactForm";

describe("quick contact presentation", () => {
  it("asks only for name and phone with accessible labels and a privacy notice", () => {
    const html = renderToStaticMarkup(<ContactForm />);
    expect(html).toContain('name="name"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('autoComplete="tel"');
    expect(html).toContain('for="contact-name"');
    expect(html).toContain('for="contact-phone"');
    expect(html).toContain('href="/privacidad"');
    expect(html).toContain("Quiero que me contacten");
    expect(html).not.toMatch(/name="(email|company|message)"|type="checkbox"/);
    expect(html).not.toContain("RESEND_API_KEY");
  });
  it("carries the selected plan without requesting more information", () => {
    expect(renderToStaticMarkup(<ContactForm plan="Ultra" source="planes" />)).toContain(
      "Me interesa el plan Ultra",
    );
  });
});
