"use client";

import {
  Buildings,
  Gauge,
  Pulse,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
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

  if (!isDeveloper && !currentMembership) {
    const onboardingItems: NavigationItem[] = [
      { href: "/panel/onboarding", label: "Crear empresa", icon: Buildings },
      { href: "/panel/perfil", label: "Mi perfil", icon: UserCircle },
      { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
    ];
    function onboardingNavigation(className: string) {
      return (
        <nav
          aria-label="Navegación del panel"
          className={`${className} panel-nav-count-${onboardingItems.length}`}
        >
          {onboardingItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href}>
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
        {onboardingNavigation("panel-nav panel-nav-desktop")}
        {onboardingNavigation("panel-mobile-nav")}
      </>
    );
  }

  const standardTenantItems: NavigationItem[] = [
    { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
    { href: `${effectiveDashboardHref}/equipo`, label: "Personal", icon: UsersThree },
    { href: `${effectiveDashboardHref}/clientes`, label: "Clientes", icon: Buildings },
    {
      href: `${effectiveDashboardHref}/configuracion`,
      label: "Configurar",
      icon: SlidersHorizontal,
    },
    { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
    { href: "/panel/perfil", label: "Mi perfil", icon: UserCircle },
  ];
  if (!isDeveloper && currentMembership?.role === "owner") {
    standardTenantItems.splice(4, 0, {
      href: "/panel/onboarding",
      label: "Nueva empresa",
      icon: Buildings,
    });
  }
  const items: NavigationItem[] = isDeveloper
    ? [
        { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
        { href: "/panel/desarrollador#empresas", label: "Empresas", icon: Buildings },
        { href: "/panel/desarrollador#usuarios", label: "Usuarios", icon: UsersThree },
        { href: "/panel/desarrollador#actividad", label: "Actividad", icon: Pulse },
        { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
        { href: "/panel/perfil", label: "Mi perfil", icon: UserCircle },
      ]
    : currentMembership?.role === "customer"
      ? [
          { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
          { href: `${effectiveDashboardHref}/clientes`, label: "Clientes", icon: Buildings },
          { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
          { href: "/panel/perfil", label: "Mi perfil", icon: UserCircle },
        ]
      : standardTenantItems;

  function isActive(href: string) {
    const [path, itemHash = ""] = href.split("#");
    if (itemHash) return path === pathname && hash === `#${itemHash}`;
    return path === pathname;
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
