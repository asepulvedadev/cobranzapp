"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";

export function ContactForm({
  plan,
  source = "contacto",
}: {
  plan?: "Pro" | "Ultra";
  source?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || status === "sent") return;
    const form = new FormData(event.currentTarget);
    const details = {
      name: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      website: String(form.get("website") ?? ""),
      plan,
      source,
    };
    const payload = JSON.stringify(details);
    if (attempt.current?.payload !== payload) {
      attempt.current = { payload, id: crypto.randomUUID() };
    }
    pending.current = true;
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ ...details, requestId: attempt.current.id }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = (await response.json()) as {
        accepted?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || result.accepted !== true) {
        if (response.status === 409) attempt.current = null;
        setStatus("error");
        setMessage(result.error?.message ?? "No pudimos enviar tu solicitud. Intenta de nuevo.");
        return;
      }
      setStatus("sent");
      setMessage("Recibimos tu solicitud. Nuestro equipo te contactará por teléfono.");
    } catch {
      setStatus("error");
      setMessage("No pudimos confirmar el envío. Revisa tu conexión e intenta de nuevo.");
    } finally {
      pending.current = false;
    }
  }

  return (
    <form className="quick-contact" onSubmit={submit} aria-label="Solicitud de contacto">
      {plan && <span className="contact-plan">Me interesa el plan {plan}</span>}
      <div className="contact-field">
        <label htmlFor="contact-name">Nombre</label>
        <input
          id="contact-name"
          name="name"
          autoComplete="name"
          placeholder="Tu nombre"
          minLength={2}
          maxLength={100}
          required
          disabled={status === "sending" || status === "sent"}
        />
      </div>
      <div className="contact-field">
        <label htmlFor="contact-phone">Teléfono</label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 000 0000"
          minLength={7}
          maxLength={30}
          required
          disabled={status === "sending" || status === "sent"}
        />
      </div>
      <div className="contact-trap" aria-hidden="true">
        <label htmlFor="contact-website">Sitio web</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="contact-consent">
        Al enviar, autorizas que usemos tu nombre y teléfono para responder esta solicitud.{" "}
        <Link href="/privacidad">Ver privacidad</Link>.
      </p>
      <button
        className="button button-dark"
        type="submit"
        disabled={status === "sending" || status === "sent"}
      >
        {status === "sending"
          ? "Enviando…"
          : status === "sent"
            ? "Solicitud enviada"
            : "Quiero que me contacten"}
      </button>
      <p
        className={`contact-feedback${status === "error" ? " contact-feedback-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
}
