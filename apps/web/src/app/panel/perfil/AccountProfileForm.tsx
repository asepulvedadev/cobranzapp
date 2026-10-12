"use client";

import { UserCircle } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useSensitiveFetch } from "../ReauthenticationProvider";

export type AccountProfile = {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  phone: string | null;
  homeAddress: string | null;
  workAddress: string | null;
  profilePhotoObjectKey: string | null;
};

async function messageFrom(response: Response | null, fallback: string) {
  const body = (await response?.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? fallback;
}

export function AccountProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter();
  const sensitiveFetch = useSensitiveFetch();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(() => Date.now());

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    const form = new FormData(event.currentTarget);
    const response = await sensitiveFetch("/api/v1/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim() || null,
        homeAddress: String(form.get("homeAddress") ?? "").trim() || null,
        workAddress: String(form.get("workAddress") ?? "").trim() || null,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await messageFrom(response, "No fue posible guardar tu perfil."));
      setError(true);
      setSaving(false);
      return;
    }
    setMessage("Perfil actualizado.");
    setSaving(false);
    router.refresh();
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Selecciona una foto de perfil.");
      setError(true);
      return;
    }
    setUploading(true);
    setMessage("");
    setError(false);
    const body = new FormData();
    body.append("file", file);
    const response = await sensitiveFetch("/api/v1/account/profile-photo", {
      method: "POST",
      body,
    }).catch(() => null);
    if (!response?.ok) {
      setMessage(await messageFrom(response, "No fue posible guardar la foto."));
      setError(true);
      setUploading(false);
      return;
    }
    setMessage("Foto guardada en el almacenamiento privado del VPS.");
    setUploading(false);
    setPhotoVersion(Date.now());
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="account-profile-grid">
      <section className="dashboard-card account-profile-photo-card">
        <div className="account-profile-avatar">
          {profile.profilePhotoObjectKey ? (
            // The endpoint verifies the authenticated session before serving the private object.
            <Image
              src={`/api/v1/account/profile-photo?v=${photoVersion}`}
              alt="Foto de perfil"
              width={112}
              height={112}
              unoptimized
            />
          ) : (
            <UserCircle aria-hidden="true" size={72} weight="duotone" />
          )}
        </div>
        <h2>{profile.displayName}</h2>
        <p>
          @{profile.username} · {profile.email}
        </p>
        <form className="member-profile-photo-form" onSubmit={upload}>
          <label htmlFor="account-profile-file">Foto de perfil</label>
          <input
            id="account-profile-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <button className="button button-secondary" disabled={uploading} type="submit">
            {uploading ? "Guardando…" : "Guardar foto"}
          </button>
        </form>
      </section>
      <form className="dashboard-card account-profile-form" onSubmit={save}>
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Información personal</span>
            <h2>Datos de tu cuenta</h2>
          </div>
        </div>
        <label>
          Nombre completo
          <input
            name="displayName"
            defaultValue={profile.displayName}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          Celular
          <input name="phone" defaultValue={profile.phone ?? ""} maxLength={30} inputMode="tel" />
        </label>
        <label>
          Dirección de casa
          <input name="homeAddress" defaultValue={profile.homeAddress ?? ""} maxLength={240} />
        </label>
        <label>
          Dirección de trabajo
          <input name="workAddress" defaultValue={profile.workAddress ?? ""} maxLength={240} />
        </label>
        <button className="button button-primary" disabled={saving} type="submit">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {message ? (
          <p className={error ? "form-message form-message-error" : "form-message"}>{message}</p>
        ) : null}
      </form>
    </div>
  );
}
