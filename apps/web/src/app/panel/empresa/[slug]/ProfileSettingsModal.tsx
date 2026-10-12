"use client";

import type { TenantMemberProfile } from "@cobranzapp/contracts";
import { useState } from "react";
import { Modal } from "../../Modal";
import { MemberProfileForm } from "./MemberProfileForm";

export function ProfileSettingsModal({
  profile,
  tenantId,
}: {
  profile: TenantMemberProfile;
  tenantId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary-action-button" onClick={() => setOpen(true)} type="button">
        Editar mi perfil
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Editar perfil">
          <MemberProfileForm profile={profile} tenantId={tenantId} />
        </Modal>
      ) : null}
    </>
  );
}
