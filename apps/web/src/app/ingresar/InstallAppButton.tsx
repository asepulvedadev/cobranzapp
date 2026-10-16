"use client";

import {
  Browser,
  Check,
  CopySimple,
  DownloadSimple,
  PlusSquare,
  ShareNetwork,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function isAppleMobileDevice(userAgent: string, platform: string, maxTouchPoints: number) {
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function isSafariOnIos(userAgent: string) {
  return (
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opios|duckduckgo|gsa|fban|fbav|instagram/i.test(userAgent)
  );
}

export function InstallAppButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    setInstalled(standalone);
    setIsIos(
      isAppleMobileDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0),
    );
    setIsSafari(isSafariOnIos(navigator.userAgent));

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed) return null;
  if (promptEvent) {
    return (
      <button
        className="login-install"
        onClick={async () => {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setPromptEvent(null);
        }}
        type="button"
      >
        <DownloadSimple aria-hidden="true" size={20} weight="bold" />
        Instalar en este dispositivo
      </button>
    );
  }
  if (!isIos) return null;

  return (
    <>
      <button
        className="login-install"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        <DownloadSimple aria-hidden="true" size={20} weight="bold" />
        Instalar app en iPhone
      </button>

      <dialog aria-labelledby="ios-install-title" className="ios-install-dialog" ref={dialogRef}>
        <div className="ios-install-sheet">
          <div aria-hidden="true" className="ios-install-handle" />
          <button
            aria-label="Cerrar instrucciones de instalación"
            className="ios-install-close"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <X aria-hidden="true" size={20} weight="bold" />
          </button>

          <div className="ios-install-heading">
            <span aria-hidden="true" className="ios-install-app-icon">
              C
            </span>
            <div>
              <span>Instalación en iPhone</span>
              <h2 id="ios-install-title">Añade cobranzapp a tu inicio</h2>
            </div>
          </div>

          {!isSafari ? (
            <div className="ios-browser-notice">
              <Browser aria-hidden="true" size={22} weight="bold" />
              <p>
                <strong>Primero abre esta página en Safari.</strong>
                La opción de instalar puede no aparecer dentro de Chrome, Instagram u otro
                navegador.
              </p>
            </div>
          ) : null}

          <ol className="ios-install-steps">
            <li>
              <span className="ios-step-icon">
                <ShareNetwork aria-hidden="true" size={22} weight="bold" />
              </span>
              <p>
                Toca <strong>Compartir</strong> en la barra de Safari.
              </p>
            </li>
            <li>
              <span className="ios-step-icon">
                <PlusSquare aria-hidden="true" size={22} weight="bold" />
              </span>
              <p>
                Elige <strong>Agregar a inicio</strong> o{" "}
                <strong>Añadir a pantalla de inicio</strong>.
              </p>
            </li>
            <li>
              <span className="ios-step-icon">
                <Check aria-hidden="true" size={22} weight="bold" />
              </span>
              <p>
                Activa <strong>Abrir como app</strong> y toca <strong>Añadir</strong>.
              </p>
            </li>
          </ol>

          {!isSafari ? (
            <button
              className="ios-copy-link"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
              }}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" size={20} weight="bold" />
              ) : (
                <CopySimple aria-hidden="true" size={20} weight="bold" />
              )}
              {copied ? "Enlace copiado" : "Copiar enlace para Safari"}
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
