import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CurrentUser, OwnerSubscriptionSummary } from "../../../lib/platform";
import { serverApi } from "../../../lib/server-api";
import { CreateCompanyOnboarding } from "./CreateCompanyOnboarding";

export const metadata: Metadata = { title: "Crear empresa" };

export default async function CompanyOnboardingPage() {
  const [response, subscriptionsResponse] = await Promise.all([
    serverApi("/v1/auth/me"),
    serverApi("/v1/account/subscriptions"),
  ]);
  if (response.status === 401) redirect("/ingresar");
  if (!response.ok) throw new Error("No fue posible validar la sesión");
  const { user } = (await response.json()) as { user: CurrentUser };
  const subscriptions = subscriptionsResponse.ok
    ? ((await subscriptionsResponse.json()) as OwnerSubscriptionSummary)
    : null;

  return (
    <div className="dashboard-page narrow-page onboarding-page">
      <header className="dashboard-header">
        <div>
          <span className="panel-eyebrow">Nuevo espacio</span>
          <h1>Crea tu empresa</h1>
          <p>
            Cada suscripción disponible permite crear una empresa y una misma cuenta puede
            administrar varias.
          </p>
        </div>
      </header>
      <section className="dashboard-card onboarding-card">
        <div className="card-heading">
          <div>
            <span className="panel-eyebrow">Activación de empresa</span>
            <h2>Datos esenciales</h2>
          </div>
          <span className="onboarding-user">{user.email}</span>
        </div>
        <CreateCompanyOnboarding availableSubscriptions={subscriptions} />
      </section>
    </div>
  );
}
