"use client";

import { useState } from "react";
import type { TenantOverview } from "../../../../lib/platform";
import { Modal } from "../../Modal";
import { WorkspaceSettingsForm } from "./WorkspaceOperations";

export function TenantSettingsModal({
  settings,
  tenantId,
}: {
  settings: TenantOverview["settings"];
  tenantId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary-action-button" onClick={() => setOpen(true)} type="button">
        Editar configuración
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Configuración de la empresa">
          <WorkspaceSettingsForm settings={settings} tenantId={tenantId} />
        </Modal>
      ) : null}
    </>
  );
}
