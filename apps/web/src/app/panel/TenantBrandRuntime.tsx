"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Membership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: "owner" | "supervisor" | "collector" | "customer";
};

type BrandSettings = {
  primaryColor: string;
  accentColor: string;
  logoObjectKey: string | null;
};

type TenantOverviewResponse = {
  settings?: Partial<BrandSettings>;
};

const fallbackBrand: BrandSettings = {
  primaryColor: "#fbbf24",
  accentColor: "#151817",
  logoObjectKey: null,
};

export function TenantBrandRuntime({
  initialBrand,
  initialLogo,
  memberships,
}: {
  initialBrand: BrandSettings;
  initialLogo: string | null;
  memberships: Membership[];
}) {
  const pathname = usePathname();
  const currentSlug = pathname.match(/^\/panel\/empresa\/([^/]+)/)?.[1];
  const currentMembership = useMemo(
    () => memberships.find((membership) => membership.tenantSlug === currentSlug) ?? memberships[0],
    [currentSlug, memberships],
  );
  const [brand, setBrand] = useState<BrandSettings>(initialBrand);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLogoFailed(false);
    if (!currentMembership) return;

    const loadBrand = async () => {
      const response = await fetchWithTimeout(
        `/api/v1/tenants/${encodeURIComponent(currentMembership.tenantId)}/overview`,
        { credentials: "include" },
      );
      if (cancelled || !response?.ok) return;
      const body = (await response.json().catch(() => null)) as TenantOverviewResponse | null;
      const settings = body?.settings;
      if (!settings || cancelled) return;
      setBrand({
        primaryColor: settings.primaryColor ?? fallbackBrand.primaryColor,
        accentColor: settings.accentColor ?? fallbackBrand.accentColor,
        logoObjectKey: settings.logoObjectKey ?? null,
      });
    };

    void loadBrand();
    return () => {
      cancelled = true;
    };
  }, [currentMembership]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".panel-shell");
    if (!shell) return;
    shell.style.setProperty("--tenant-brand-primary", brand.primaryColor);
    shell.style.setProperty("--tenant-brand-accent", brand.accentColor);
  }, [brand]);

  if (!currentMembership) return null;
  const logoSource =
    !logoFailed && (brand.logoObjectKey || (currentMembership === memberships[0] && initialLogo))
      ? `/api/v1/tenants/${encodeURIComponent(currentMembership.tenantId)}/brand-logo`
      : null;

  return (
    <div className="sidebar-company-stack">
      <div className="sidebar-company-brand">
        {logoSource ? (
          // biome-ignore lint/performance/noImgElement: Private API image is not externally optimizable.
          <img
            alt=""
            className="sidebar-company-logo"
            onError={() => setLogoFailed(true)}
            src={logoSource}
          />
        ) : (
          <span className="sidebar-company-mark" aria-hidden="true">
            {currentMembership.tenantName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <strong>{currentMembership.tenantName}</strong>
      </div>
      {currentMembership.role === "owner" && memberships.length > 1 ? (
        <WorkspaceSwitcher className="workspace-switcher-desktop" memberships={memberships} />
      ) : null}
    </div>
  );
}
