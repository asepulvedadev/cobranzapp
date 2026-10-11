"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <button
      aria-label={isPending ? "Cerrando sesión" : "Cerrar sesión"}
      className="panel-logout"
      disabled={isPending}
      onClick={logout}
      type="button"
    >
      <SignOut aria-hidden="true" size={20} />
      <span>{isPending ? "Cerrando…" : "Cerrar sesión"}</span>
    </button>
  );
}
