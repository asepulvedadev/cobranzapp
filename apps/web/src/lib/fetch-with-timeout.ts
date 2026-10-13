const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Keep browser mutations finite even when a proxy or mobile network silently
 * drops a connection. Callers receive a structured 408 they can show to users.
 */
export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch {
    if (didTimeout) {
      return new Response(
        JSON.stringify({
          error: {
            code: "REQUEST_TIMEOUT",
            message:
              "La solicitud tardó demasiado. Verifica tu conexión y vuelve a intentarlo; no se confirmó ningún cambio.",
          },
        }),
        { status: 408, headers: { "content-type": "application/json" } },
      );
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener("abort", abortFromCaller);
  }
}
