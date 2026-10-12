"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      aria-labelledby="modal-title"
      className="panel-modal"
      onCancel={onClose}
      ref={dialogRef}
    >
      <div className="panel-modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button aria-label="Cerrar ventana" className="modal-close" onClick={onClose} type="button">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
