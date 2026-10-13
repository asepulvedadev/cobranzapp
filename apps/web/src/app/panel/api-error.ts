type ApiErrorBody = {
  error?: {
    message?: string;
    requestId?: string;
  };
};

/** Keeps a support reference visible when the API returns a request id. */
export function formatApiError(body: unknown, fallback: string) {
  const parsed = body as ApiErrorBody | undefined;
  const message = parsed?.error?.message ?? fallback;
  const requestId = parsed?.error?.requestId;
  return requestId ? `${message} Código de soporte: ${requestId}` : message;
}
