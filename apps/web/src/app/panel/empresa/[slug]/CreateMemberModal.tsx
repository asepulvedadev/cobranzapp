"use client";

import { tenantMemberCreateRequestSchema } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { formatApiError } from "../../api-error";
import { Modal } from "../../Modal";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { usePanelUiStore } from "../../ui-store";

type CreatedCredentials = {
  username: string;
  phone: string;
  password: string;
};

export function CreateMemberModal({
  tenantId,
  availableSeats,
}: {
  tenantId: string;
  availableSeats: number | null;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const open = usePanelUiStore((state) => state.isCreateMemberModalOpen);
  const openModal = usePanelUiStore((state) => state.openCreateMemberModal);
  const closeModal = usePanelUiStore((state) => state.closeCreateMemberModal);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);

  function close() {
    if (isSubmitting) return;
    closeModal();
    setMessage("");
    setIsError(false);
    setCreated(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      username: String(form.get("username") ?? "")
        .trim()
        .toLowerCase(),
      displayName: String(form.get("displayName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? "collector"),
    };
    const parsed = tenantMemberCreateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Revisa los datos del empleado.");
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
    const response = await sensitiveFetch(`/api/v1/tenants/${tenantId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      setMessage(
        response?.status === 428
          ? "La confirmación de seguridad tardó demasiado. Inténtalo de nuevo."
          : formatApiError(body, "No fue posible crear el empleado."),
      );
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
    setCreated({ username: payload.username, phone: payload.phone, password: payload.password });
    setMessage("Empleado creado. Entrega estas credenciales por un canal seguro.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <>
      <button
        className="primary-action"
        onClick={() => {
          setMessage("");
          setIsError(false);
          setCreated(null);
          openModal();
        }}
        type="button"
      >
        Crear empleado
      </button>
      {open ? (
        <Modal onClose={close} title={created ? "Empleado creado" : "Crear empleado"}>
          {created ? (
            <div className="credential-result">
              <p className="operational-note">
                Guarda estas credenciales ahora. No se envían por correo.
              </p>
              <dl>
                <div>
                  <dt>Usuario</dt>
                  <dd>{created.username}</dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>{created.phone}</dd>
                </div>
                <div>
                  <dt>Contraseña temporal</dt>
                  <dd>
                    <code>{created.password}</code>
                  </dd>
                </div>
              </dl>
              <button onClick={close} type="button">
                Cerrar
              </button>
            </div>
          ) : (
            <form className="tenant-form" onSubmit={submit}>
              <p className="operational-note">
                Crea el acceso directamente con usuario, teléfono y contraseña. El empleado no
                necesita correo.
              </p>
              {availableSeats !== null ? (
                <small>{availableSeats} cupo(s) disponibles según tu plan.</small>
              ) : null}
              <label htmlFor="member-display-name">Nombre completo</label>
              <input id="member-display-name" name="displayName" required maxLength={160} />
              <label htmlFor="member-username">Nombre de usuario</label>
              <input
                autoCapitalize="none"
                autoComplete="username"
                id="member-username"
                name="username"
                pattern="[a-z0-9][a-z0-9._-]{2,31}"
                placeholder="ej. maria.gomez"
                required
              />
              <small>Usa minúsculas, números, punto, guion o guion bajo.</small>
              <label htmlFor="member-phone">Teléfono</label>
              <input id="member-phone" name="phone" required maxLength={30} type="tel" />
              <label htmlFor="member-role">Rol</label>
              <select defaultValue="collector" id="member-role" name="role">
                <option value="collector">Cobrador</option>
                <option value="supervisor">Supervisor</option>
              </select>
              <label htmlFor="member-password">Contraseña inicial</label>
              <input
                autoComplete="new-password"
                id="member-password"
                minLength={12}
                name="password"
                required
                type="password"
              />
              <small>Usa al menos 12 caracteres. Entrégala por un canal seguro.</small>
              {message ? (
                <p className={`tenant-form-message${isError ? " form-message-error" : ""}`}>
                  {message}
                </p>
              ) : null}
              <button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creando…" : "Crear empleado"}
              </button>
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
