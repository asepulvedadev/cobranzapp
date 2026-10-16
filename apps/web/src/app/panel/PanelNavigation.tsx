"use client";

import {
  Buildings,
  DotsThreeCircle,
  Gauge,
  MapPin,
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
import { Modal } from "./Modal";

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
  const [moreOpen, setMoreOpen] = useState(false);
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

  const accountItems: NavigationItem[] = [
    { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
    { href: "/panel/perfil", label: "Mi perfil", icon: UserCircle },
  ];

  let primaryItems: NavigationItem[] = [];
  let secondaryItems: NavigationItem[] = [];

  if (!isDeveloper && !currentMembership) {
    primaryItems = [
      { href: "/panel/onboarding", label: "Crear empresa", icon: Buildings },
      ...accountItems,
    ];
  } else if (isDeveloper) {
    primaryItems = [
      { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
      { href: "/panel/desarrollador#empresas", label: "Empresas", icon: Buildings },
      { href: "/panel/desarrollador#usuarios", label: "Usuarios", icon: UsersThree },
    ];
    secondaryItems = [
      { href: "/panel/desarrollador#actividad", label: "Actividad", icon: Pulse },
      ...accountItems,
    ];
  } else if (currentMembership?.role === "customer") {
    primaryItems = [
      { href: effectiveDashboardHref, label: "Inicio", icon: Gauge },
      { href: "/panel/perfil", label: "Mi perfil", icon: UserCircle },
      { href: "/panel/seguridad", label: "Seguridad", icon: ShieldCheck },
    ];
  } else {
    const role = currentMembership?.role;
    const tenantItems = {
      home: {
        href: effectiveDashboardHref,
        label: role === "collector" ? "Hoy" : "Inicio",
        icon: Gauge,
      },
      clients: { href: `${effectiveDashboardHref}/clientes`, label: "Clientes", icon: Buildings },
      routes: { href: `${effectiveDashboardHref}/rutas`, label: "Rutas", icon: MapPin },
      verify: {
        href: `${effectiveDashboardHref}/verificacion`,
        label: "Verificar",
        icon: ShieldCheck,
      },
      team: { href: `${effectiveDashboardHref}/equipo`, label: "Personal", icon: UsersThree },
      settings: {
        href: `${effectiveDashboardHref}/configuracion`,
        label: "Empresa",
        icon: SlidersHorizontal,
      },
    } satisfies Record<string, NavigationItem>;

    if (role === "collector") {
      primaryItems = [
        tenantItems.home,
        tenantItems.clients,
        tenantItems.routes,
        tenantItems.verify,
      ];
      secondaryItems = accountItems;
    } else if (role === "supervisor") {
      primaryItems = [tenantItems.home, tenantItems.clients, tenantItems.routes, tenantItems.team];
      secondaryItems = [tenantItems.verify, tenantItems.settings, ...accountItems];
    } else {
      primaryItems = [tenantItems.home, tenantItems.clients, tenantItems.team];
      secondaryItems = [
        tenantItems.routes,
        tenantItems.verify,
        tenantItems.settings,
        { href: "/panel/onboarding", label: "Nueva empresa", icon: Buildings },
        ...accountItems,
      ];
    }
  }

  const desktopItems = [...primaryItems, ...secondaryItems];

  function isActive(href: string) {
    const [path, itemHash = ""] = href.split("#");
    if (itemHash) return path === pathname && hash === `#${itemHash}`;
    return path === pathname;
  }

  function navLink(item: NavigationItem, closeSheet = false) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        href={item.href}
        key={item.href}
        onClick={() => {
          setHash(item.href.includes("#") ? `#${item.href.split("#")[1]}` : "");
          if (closeSheet) setMoreOpen(false);
        }}
      >
        <Icon aria-hidden="true" size={22} weight={active ? "fill" : "regular"} />
        <span>{item.label}</span>
      </Link>
    );
  }

  const secondaryActive = secondaryItems.some((item) => isActive(item.href));

  return (
    <>
      <nav aria-label="Navegación principal" className="panel-nav panel-nav-desktop">
        {desktopItems.map((item) => navLink(item))}
      </nav>
      <nav
        aria-label="Navegación principal"
        className={`panel-mobile-nav panel-nav-count-${primaryItems.length + (secondaryItems.length ? 1 : 0)}`}
      >
        {primaryItems.map((item) => navLink(item))}
        {secondaryItems.length ? (
          <button
            aria-current={secondaryActive ? "page" : undefined}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            type="button"
          >
            <DotsThreeCircle
              aria-hidden="true"
              size={22}
              weight={secondaryActive ? "fill" : "regular"}
            />
            <span>Más</span>
          </button>
        ) : null}
      </nav>
      {moreOpen ? (
        <Modal className="navigation-sheet" onClose={() => setMoreOpen(false)} title="Más opciones">
          <nav aria-label="Opciones adicionales" className="navigation-sheet-list">
            {secondaryItems.map((item) => navLink(item, true))}
          </nav>
        </Modal>
      ) : null}
    </>
  );
}
