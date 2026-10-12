"use client";

import type { TenantMemberProfile } from "@cobranzapp/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "../../ReauthenticationProvider";

type ContactDraft = {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
};

function newContact(): ContactDraft {
  return { id: crypto.randomUUID(), fullName: "", relationship: "", phone: "" };
}

function profileContacts(profile: TenantMemberProfile) {
  return profile.emergencyContacts.length
    ? profile.emergencyContacts.map(({ id, fullName, relationship, phone }) => ({
        id,
        fullName,
        relationship,
        phone,
      }))
    : [newContact()];
}

async function errorMessage(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? "No fue posible guardar tu ficha operativa.";
}

export function MemberProfileForm({
  tenantId,
  profile,
}: {
  tenantId: string;
  profile: TenantMemberProfile;
}) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [contacts, setContacts] = useState<ContactDraft[]>(() => profileContacts(profile));
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateContact(index: number, field: keyof ContactDraft, value: string) {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: value } : contact,
      ),
    );
  }

  function addContact() {
    setContacts((current) => (current.length < 2 ? [...current, newContact()] : current));
  }

  function removeContact(index: number) {
    setContacts((current) => current.filter((_, contactIndex) => contactIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const bloodType = String(form.get("bloodType") ?? "").trim() || null;
    const consentGiven = form.get("bloodTypeConsent") === "on";
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/members/${profile.userId}/profile`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: String(form.get("phone") ?? "").trim() || null,
          homeAddress: String(form.get("homeAddress") ?? "").trim() || null,
          workAddress: String(form.get("workAddress") ?? "").trim() || null,
          profilePhotoObjectKey: profile.profilePhotoObjectKey,
          bloodType,
          bloodTypeConsentVersion: bloodType && consentGiven ? "staff-profile-v1" : null,
          emergencyContacts: contacts
            .map((contact) => ({
              fullName: contact.fullName.trim(),
              relationship: contact.relationship.trim(),
              phone: contact.phone.trim(),
            }))
            .filter((contact) => contact.fullName || contact.relationship || contact.phone),
        }),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setMessage(await errorMessage(response));
      setIsError(true);
      setIsSubmitting(false);
      return;
    }
    setMessage("Ficha operativa guardada.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form className="tenant-form member-profile-form" onSubmit={submit}>
      <p className="operational-note">
        Completa solo los datos necesarios para operar. La foto de perfil será privada; no es una
        selfie ni una prueba de identidad.
      </p>
      <label htmlFor="profile-phone">Celular</label>
      <input
        defaultValue={profile.phone ?? ""}
        id="profile-phone"
        maxLength={30}
        name="phone"
        placeholder="+57 300 000 0000"
        type="tel"
      />
      <label htmlFor="profile-home-address">Dirección de casa</label>
      <input
        defaultValue={profile.homeAddress ?? ""}
        id="profile-home-address"
        maxLength={240}
        name="homeAddress"
        placeholder="Dirección, barrio, ciudad"
      />
      <label htmlFor="profile-work-address">Dirección de trabajo</label>
      <input
        defaultValue={profile.workAddress ?? ""}
        id="profile-work-address"
        maxLength={240}
        name="workAddress"
        placeholder="Dirección, barrio, ciudad"
      />
      <fieldset className="member-profile-fieldset">
        <legend>Tipo de sangre (opcional)</legend>
        <select defaultValue={profile.bloodType ?? ""} name="bloodType">
          <option value="">No registrar</option>
          {(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label className="member-profile-consent">
          <input
            defaultChecked={Boolean(profile.bloodTypeConsentVersion)}
            name="bloodTypeConsent"
            type="checkbox"
          />
          <span>Autorizo guardar este dato para atención operativa.</span>
        </label>
      </fieldset>
      <fieldset className="member-profile-fieldset">
        <legend>Contactos de emergencia</legend>
        {contacts.map((contact, index) => (
          <div className="member-profile-contact" key={contact.id}>
            <strong>Contacto {index + 1}</strong>
            <input
              aria-label={`Nombre del contacto ${index + 1}`}
              maxLength={120}
              onChange={(event) => updateContact(index, "fullName", event.target.value)}
              placeholder="Nombre completo"
              value={contact.fullName}
            />
            <input
              aria-label={`Relación del contacto ${index + 1}`}
              maxLength={80}
              onChange={(event) => updateContact(index, "relationship", event.target.value)}
              placeholder="Relación"
              value={contact.relationship}
            />
            <input
              aria-label={`Celular del contacto ${index + 1}`}
              maxLength={30}
              onChange={(event) => updateContact(index, "phone", event.target.value)}
              placeholder="Celular"
              type="tel"
              value={contact.phone}
            />
            {contacts.length > 1 ? (
              <button className="button-link" onClick={() => removeContact(index)} type="button">
                Quitar contacto
              </button>
            ) : null}
          </div>
        ))}
        {contacts.length < 2 ? (
          <button className="button-link" onClick={addContact} type="button">
            + Agregar otro contacto
          </button>
        ) : null}
      </fieldset>
      {message ? (
        <p className={`tenant-form-message${isError ? " form-message-error" : ""}`} role="status">
          {message}
        </p>
      ) : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Guardando…" : "Guardar ficha"}
      </button>
    </form>
  );
}
