"use client";

import type { ReactNode } from "react";

export function Modal({
  children,
  className,
  onClose,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="panel-modal-layer" role="presentation">
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={className ? `panel-modal ${className}` : "panel-modal"}
        role="dialog"
      >
        <div className="panel-modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            aria-label="Cerrar ventana"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
