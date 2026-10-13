"use client";

import type { TenantMemberProfile } from "@cobranzapp/contracts";
import { useState } from "react";
import { Modal } from "../../Modal";
import { MemberProfileForm } from "./MemberProfileForm";

export function MemberProfileEditModal({
  profile,
  tenantId,
  displayName,
}: {
  profile: TenantMemberProfile;
  tenantId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button-link" onClick={() => setOpen(true)} type="button">
        Editar ficha
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title={`Editar ficha de ${displayName}`}>
          <MemberProfileForm profile={profile} tenantId={tenantId} />
        </Modal>
      ) : null}
    </>
  );
}
