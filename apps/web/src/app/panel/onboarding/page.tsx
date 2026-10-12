import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CurrentUser } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { CreateCompanyOnboarding } from "./CreateCompanyOnboarding";

export const metadata: Metadata = { title: "Crear empresa" };

export default async function CompanyOnboardingPage() {
  const response = await serverApi("/v1/auth/me");
  if (response.status === 401) redirect("/ingresar");
  if (!response.ok) throw new Error("No fue posible validar la sesión");
  const { user } = (await response.json()) as { user: CurrentUser };

  return (
    <div className="dashboard-page narrow-page onboarding-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Nuevo espacio</span>
          <h1>Crea tu empresa</h1>
          <p>
            Una misma cuenta puede administrar varias empresas. Empieza con el nombre y completa los
            datos operativos en el siguiente paso.
          </p>
        </div>
      </header>
      <section className="dashboard-card onboarding-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Paso 1 de 2</span>
            <h2>Datos esenciales</h2>
          </div>
          <span className="onboarding-user">{user.email}</span>
        </div>
        <CreateCompanyOnboarding />
      </section>
    </div>
  );
}
