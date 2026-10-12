import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("simplified public navigation", () => {
  it("keeps Plans in the desktop navigation and mobile menu without an external shortcut", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    expect(html).not.toContain("nav-plans-shortcut");
    expect(html.match(/href="\/#planes"/g)).toHaveLength(2);
    const mobileMenu = html.match(/class="mobile-menu-panel">(.*?)<\/div>/)?.[1];
    expect(mobileMenu).toContain('href="/#planes"');
    expect(mobileMenu).toContain("Planes");
  });

  it("removes the demo CTA from desktop and mobile navigation", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    expect(html).not.toContain("Solicitar demostración");
    expect(html).not.toContain("source=demo");
  });

  it("keeps one accessible login link with an icon and no visible text", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    const login = html.match(/<a[^>]*class="nav-login"[^>]*>(.*?)<\/a>/)?.[0];
    expect(login).toContain('href="/ingresar"');
    expect(login).toContain('aria-label="Ingresar"');
    expect(login).toContain('title="Ingresar"');
    expect(login).toContain("<svg");
    expect(login).toContain('aria-hidden="true"');
    expect(login).not.toMatch(/>\s*Ingresar\s*</);
    expect(html.match(/href="\/ingresar"/g)).toHaveLength(1);
  });
});
