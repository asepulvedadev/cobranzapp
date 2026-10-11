"use client";

import { usePathname, useRouter } from "next/navigation";

type Membership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: "owner" | "supervisor" | "collector" | "customer";
};

export function WorkspaceSwitcher({
  className,
  memberships,
}: {
  className: string;
  memberships: Membership[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSlug = pathname.match(/^\/panel\/empresa\/([^/]+)/)?.[1];
  const selectedSlug = memberships.some((item) => item.tenantSlug === currentSlug)
    ? currentSlug
    : memberships[0]?.tenantSlug;

  if (memberships.length < 2) return null;

  return (
    <label className={className}>
      <span>Espacio de trabajo</span>
      <select
        aria-label="Cambiar espacio de trabajo"
        onChange={(event) => router.push(`/panel/empresa/${event.target.value}`)}
        value={selectedSlug}
      >
        {memberships.map((membership) => (
          <option key={membership.tenantId} value={membership.tenantSlug}>
            {membership.tenantName}
          </option>
        ))}
      </select>
    </label>
  );
}
