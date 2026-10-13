import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverApi } from "../../../lib/server-api";
import { type AccountProfile, AccountProfileModal } from "./AccountProfileForm";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const response = await serverApi("/v1/account/profile");
  if (response.status === 401) redirect("/ingresar");
  if (!response.ok) throw new Error("No fue posible cargar tu perfil");
  const { profile } = (await response.json()) as { profile: AccountProfile };
  return (
    <div className="dashboard-page account-profile-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Cuenta</span>
          <h1>Mi perfil</h1>
          <p>Consulta tus datos y edítalos en una ventana segura.</p>
        </div>
      </header>
      <AccountProfileModal profile={profile} />
    </div>
  );
}
