import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../../components/Brand";
import type { CurrentUser, InvitationPreview } from "../../lib/platform";
import { serverApi } from "../../lib/server-api";
import { InvitationAcceptanceForm } from "./InvitationAcceptanceForm";
import "./activation.css";

export const metadata: Metadata = {
  title: "Activar cuenta",
  robots: { index: false, follow: false },
};

const roleLabels = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
};

export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const response = token ? await serverApi(`/v1/invitations/${encodeURIComponent(token)}`) : null;
  const invitation = response?.ok
    ? ((await response.json()) as { invitation: InvitationPreview }).invitation
    : null;

  let currentUser: CurrentUser | null = null;
  if (invitation?.accountExists) {
    const currentUserResponse = await serverApi("/v1/auth/me");
    if (currentUserResponse.ok) {
      currentUser = ((await currentUserResponse.json()) as { user: CurrentUser }).user;
    }
  }

  return (
    <main className="activation-page">
      <div className="activation-shell">
        <header>
          <Brand />
          <Link href="/">Volver al inicio</Link>
        </header>
        {invitation ? (
          <section className="activation-card">
            <div className="activation-summary">
              <span className="activation-kicker">Invitación empresarial</span>
              <h1>Únete a {invitation.tenantName}</h1>
              <p>
                Te invitaron como <strong>{roleLabels[invitation.role]}</strong>. La invitación está
                asociada a <strong>{invitation.email}</strong>.
              </p>
              <dl>
                <div>
                  <dt>Empresa</dt>
                  <dd>{invitation.tenantName}</dd>
                </div>
                <div>
                  <dt>Rol</dt>
                  <dd>{roleLabels[invitation.role]}</dd>
                </div>
                <div>
                  <dt>Vence</dt>
                  <dd>
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "long",
                      timeStyle: "short",
                    }).format(new Date(invitation.expiresAt))}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="activation-action">
              {invitation.accountExists && currentUser?.email !== invitation.email ? (
                <>
                  <span className="activation-kicker">Cuenta existente</span>
                  <h2>Inicia sesión para continuar</h2>
                  <p>Ya existe una cuenta con este correo. Debes validarla antes de aceptar.</p>
                  <Link
                    className="activation-primary"
                    href={`/ingresar?siguiente=${encodeURIComponent(`/activar?token=${token}`)}`}
                  >
                    Iniciar sesión
                  </Link>
                </>
              ) : (
                <InvitationAcceptanceForm
                  accountExists={invitation.accountExists}
                  email={invitation.email}
                  tenantSlug={invitation.tenantSlug}
                  token={token}
                />
              )}
            </div>
          </section>
        ) : (
          <section className="activation-invalid">
            <span>Invitación no disponible</span>
            <h1>Este enlace venció o ya fue utilizado.</h1>
            <p>Solicita una nueva invitación al propietario de la empresa.</p>
            <Link className="activation-primary" href="/ingresar">
              Ir al ingreso
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
