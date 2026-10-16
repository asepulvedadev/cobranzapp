"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
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
  if (isIos) {
    return (
      <p className="login-install-hint">En iPhone: toca Compartir y luego “Agregar a inicio”.</p>
    );
  }
  return null;
}
