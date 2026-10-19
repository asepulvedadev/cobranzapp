"use client";

import { useEffect } from "react";

const releaseStorageKey = "cobranzapp_release";
const updateIntervalMs = 5 * 60 * 1_000;

export function shouldReloadForRelease(installedVersion: string | null, currentVersion: string) {
  return Boolean(
    installedVersion?.trim() && currentVersion.trim() && installedVersion !== currentVersion,
  );
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    let checking = false;
    let reloadRequested = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let removeCheckListeners: (() => void) | null = null;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const reloadOnce = () => {
      if (cancelled || reloadRequested) return;
      reloadRequested = true;
      window.location.reload();
    };

    const controllerChanged = () => {
      if (hadController) reloadOnce();
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        const checkForUpdate = async () => {
          if (checking || cancelled) return;
          checking = true;
          try {
            await registration.update();
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            const response = await fetch(`/health?update=${Date.now()}`, {
              cache: "no-store",
              headers: { accept: "application/json" },
            });
            if (!response.ok) return;
            const body = (await response.json()) as { version?: unknown };
            if (typeof body.version !== "string" || !body.version.trim()) return;
            const installedVersion = window.localStorage.getItem(releaseStorageKey);
            window.localStorage.setItem(releaseStorageKey, body.version);
            if (shouldReloadForRelease(installedVersion, body.version)) reloadOnce();
          } catch {
            // Being offline must never prevent the installed app from opening.
          } finally {
            checking = false;
          }
        };

        const checkWhenVisible = () => {
          if (document.visibilityState === "visible") void checkForUpdate();
        };
        document.addEventListener("visibilitychange", checkWhenVisible);
        window.addEventListener("focus", checkWhenVisible);
        intervalId = setInterval(checkWhenVisible, updateIntervalMs);
        void checkForUpdate();

        removeCheckListeners = () => {
          document.removeEventListener("visibilitychange", checkWhenVisible);
          window.removeEventListener("focus", checkWhenVisible);
        };
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      removeCheckListeners?.();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return null;
}
