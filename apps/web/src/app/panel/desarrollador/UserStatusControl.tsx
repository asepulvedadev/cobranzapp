"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export function UserStatusControl({
  status,
  userId,
}: {
  status: "active" | "disabled";
  userId: string;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const targetStatus = status === "active" ? "disabled" : "active";

  async function updateStatus() {
    setMessage("");
    setIsSubmitting(true);
    const response = await sensitiveFetch(`/api/v1/platform/users/${userId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as
        | { error?: { message?: string } }
        | undefined;
      setMessage(body?.error?.message ?? "No fue posible cambiar el acceso.");
      setIsSubmitting(false);
      return;
    }
    setMessage(targetStatus === "disabled" ? "Acceso deshabilitado." : "Acceso habilitado.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <div className="table-action">
      <button disabled={isSubmitting} onClick={updateStatus} type="button">
        {isSubmitting ? "Procesando…" : targetStatus === "disabled" ? "Deshabilitar" : "Habilitar"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
