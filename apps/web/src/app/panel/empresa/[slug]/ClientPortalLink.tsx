"use client";

import { useState } from "react";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

export function ClientPortalLink({
  tenantId,
  borrowerId,
  borrowerName,
  whatsappPhone,
}: {
  tenantId: string;
  borrowerId: string;
  borrowerName: string;
  whatsappPhone: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadOrCreate() {
    setOpen(true);
    setBusy(true);
    setMessage("");
    const path = `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/portal-link`;
    const current = await fetch(path, { cache: "no-store" }).catch(() => null);
    if (current?.ok) {
      const body = (await current.json()) as { url?: string; active?: boolean };
      if (body.url && body.active) {
        setUrl(body.url);
        setBusy(false);
        return;
      }
    }
    const created = await sensitiveFetch(path, { method: "POST" }).catch(() => null);
    if (!created?.ok) {
      setMessage("No fue posible crear el enlace privado.");
      setBusy(false);
      return;
    }
    const body = (await created.json()) as { url?: string };
    setUrl(body.url ?? "");
    setBusy(false);
  }

  async function rotate() {
    setBusy(true);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/borrowers/${borrowerId}/portal-link`,
      { method: "POST" },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage("No fue posible renovar el enlace.");
      setBusy(false);
      return;
    }
    const body = (await response.json()) as { url?: string };
    setUrl(body.url ?? "");
    setMessage("Enlace anterior desactivado. Ya puedes compartir el nuevo.");
    setBusy(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setMessage("Enlace copiado.");
  }

  const shareText = `Hola ${borrowerName}, aquí puedes consultar el estado de tu crédito y tus pagos: ${url}`;
  const whatsappUrl = `https://wa.me/${whatsappNumber(whatsappPhone)}?text=${encodeURIComponent(shareText)}`;

  return (
    <>
      <button className="collector-client-action" onClick={() => void loadOrCreate()} type="button">
        Compartir estado
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Perfil privado del cliente">
          <div className="client-link-panel">
            <p>
              {borrowerName} podrá ver su saldo, próximas fechas y pagos confirmados sin crear una
              contraseña.
            </p>
            {busy ? <div className="client-link-loading">Preparando enlace…</div> : null}
            {url && !busy ? (
              <>
                <label>
                  Enlace privado
                  <input readOnly value={url} />
                </label>
                <div className="client-link-actions">
                  <button onClick={() => void copyLink()} type="button">
                    Copiar
                  </button>
                  <a href={whatsappUrl} rel="noreferrer" target="_blank">
                    Enviar por WhatsApp
                  </a>
                </div>
                <button
                  className="client-link-rotate"
                  disabled={busy}
                  onClick={() => void rotate()}
                  type="button"
                >
                  Crear un enlace nuevo
                </button>
              </>
            ) : null}
            {message ? <p className="tenant-form-message">{message}</p> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
