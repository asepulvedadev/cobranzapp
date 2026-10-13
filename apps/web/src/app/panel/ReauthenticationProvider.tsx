"use client";

import { LockKey } from "@phosphor-icons/react";
import { createContext, type FormEvent, type ReactNode, useContext, useRef, useState } from "react";

type PendingRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  initialResponse: Response;
  resolve: (response: Response | null) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type SensitiveFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response | null>;

const SensitiveFetchContext = createContext<SensitiveFetch | null>(null);

async function apiError(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? fallback;
}

export function ReauthenticationProvider({
  children,
  username,
}: {
  children: ReactNode;
  username: string;
}) {
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRequests = useRef<PendingRequest[]>([]);

  async function sensitiveFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch(input, init).catch(() => null);
    if (response?.status !== 428) return response;

    return new Promise<Response | null>((resolve) => {
      const pendingRequest: PendingRequest = {
        input,
        init,
        initialResponse: response,
        resolve,
        timeoutId: setTimeout(() => {
          pendingRequests.current = pendingRequests.current.filter(
            (request) => request !== pendingRequest,
          );
          resolve(
            new Response(
              JSON.stringify({
                error: { message: "La confirmación de seguridad expiró. Inténtalo de nuevo." },
              }),
              { status: 408, headers: { "content-type": "application/json" } },
            ),
          );
          setHasPendingRequest(pendingRequests.current.length > 0);
        }, 30_000),
      };
      pendingRequests.current.push(pendingRequest);
      setMessage("");
      setHasPendingRequest(true);
    });
  }

  function closeDialog() {
    for (const request of pendingRequests.current.splice(0)) {
      clearTimeout(request.timeoutId);
      request.resolve(request.initialResponse);
    }
    setPassword("");
    setMessage("");
    setHasPendingRequest(false);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const response = await fetch("/api/v1/auth/reauthenticate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await apiError(response, "No fue posible confirmar tu identidad."));
      setIsSubmitting(false);
      return;
    }

    const requests = pendingRequests.current.splice(0);
    setPassword("");
    setHasPendingRequest(false);
    await Promise.all(
      requests.map(async (request) => {
        clearTimeout(request.timeoutId);
        const retried = await fetch(request.input, request.init).catch(() => null);
        request.resolve(retried);
      }),
    );
    setIsSubmitting(false);
  }

  return (
    <SensitiveFetchContext.Provider value={sensitiveFetch}>
      {children}
      {hasPendingRequest ? (
        <div className="reauthentication-backdrop">
          <section
            aria-describedby="reauthentication-description"
            aria-labelledby="reauthentication-title"
            aria-modal="true"
            className="reauthentication-dialog"
            role="dialog"
          >
            <span className="reauthentication-icon" aria-hidden="true">
              <LockKey size={24} weight="bold" />
            </span>
            <div>
              <span className="panel-eyebrow">Acción protegida</span>
              <h2 id="reauthentication-title">Confirma que eres tú</h2>
              <p id="reauthentication-description">
                Escribe tu contraseña para continuar. La confirmación será válida durante 10 minutos
                en este dispositivo.
              </p>
            </div>
            <form onSubmit={confirm}>
              <input autoComplete="username" name="username" type="hidden" value={username} />
              <label htmlFor="reauthentication-password">Contraseña actual</label>
              <input
                autoComplete="current-password"
                id="reauthentication-password"
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              {message ? (
                <p className="reauthentication-message" role="alert">
                  {message}
                </p>
              ) : null}
              <div>
                <button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Confirmando…" : "Confirmar y continuar"}
                </button>
                <button
                  className="reauthentication-cancel"
                  disabled={isSubmitting}
                  onClick={closeDialog}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </SensitiveFetchContext.Provider>
  );
}

export function useSensitiveFetch() {
  const sensitiveFetch = useContext(SensitiveFetchContext);
  if (!sensitiveFetch) throw new Error("useSensitiveFetch requires ReauthenticationProvider");
  return sensitiveFetch;
}
