"use client";

import { X } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useId, useRef } from "react";

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
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="panel-modal-layer">
      <button
        aria-label="Cerrar ventana"
        className="panel-modal-backdrop"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={className ? `panel-modal ${className}` : "panel-modal"}
        role="dialog"
      >
        <div className="panel-modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="Cerrar ventana"
            className="modal-close"
            onClick={onClose}
            ref={closeButton}
            type="button"
          >
            <X aria-hidden="true" size={20} weight="bold" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
