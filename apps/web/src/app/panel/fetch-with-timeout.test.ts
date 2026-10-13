import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../../lib/fetch-with-timeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns an actionable response instead of leaving a request pending", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted")));
          }),
      ),
    );

    const pending = fetchWithTimeout("/api/v1/tenants");
    await vi.advanceTimersByTimeAsync(20_000);
    const response = await pending;

    expect(response?.status).toBe(408);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "REQUEST_TIMEOUT" },
    });
  });
});
