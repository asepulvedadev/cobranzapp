"use client";

import {
  Buildings,
  Gauge,
  Pulse,
  ShieldCheck,
  SlidersHorizontal,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CurrentUser } from "../../lib/platform";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
};

export function PanelNavigation({
  dashboardHref,
  isDeveloper,
  memberships,
}: {
  dashboardHref: string;
  isDeveloper: boolean;
  memberships: CurrentUser["memberships"];
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const currentTenantPath = pathname.match(/^\/panel\/empresa\/[^/]+/)?.[0];
  const effectiveDashboardHref = isDeveloper ? dashboardHref : (currentTenantPath ?? dashboardHref);
  const currentMembership =
    memberships.find(
      (membership) => `/panel/empresa/${membership.tenantSlug}` === currentTenantPath,
    ) ?? memberships[0];

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  const standardTenantItems: NavigationItem[] = [
    { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
    { href: `${effectiveDashboardHref}#equipo`, label: "Equipo", icon: UsersThree },
    {
      href: `${effectiveDashboardHref}#configuracion`,
      label: "Configurar",
      icon: SlidersHorizontal,
    },
    { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
  ];
  const items: NavigationItem[] = isDeveloper
    ? [
        { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
        { href: "/panel/desarrollador#empresas", label: "Empresas", icon: Buildings },
        { href: "/panel/desarrollador#actividad", label: "Actividad", icon: Pulse },
        { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
      ]
    : currentMembership?.role === "customer"
      ? [
          { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
          { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
        ]
      : standardTenantItems;

  function isActive(href: string) {
    const [path, itemHash = ""] = href.split("#");
    if (path !== pathname) return false;
    if (itemHash) return hash === `#${itemHash}`;
    return hash === "";
  }

  function navigation(className: string) {
    return (
      <nav
        aria-label="Navegación del panel"
        className={`${className} panel-nav-count-${items.length}`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              href={item.href}
              key={item.href}
              onClick={() => setHash(item.href.includes("#") ? `#${item.href.split("#")[1]}` : "")}
            >
              <Icon aria-hidden="true" size={22} weight={active ? "fill" : "regular"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {navigation("panel-nav panel-nav-desktop")}
      {navigation("panel-mobile-nav")}
    </>
  );
}
