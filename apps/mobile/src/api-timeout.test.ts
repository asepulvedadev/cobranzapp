import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, requestTimeoutMessage } from "./request-timeout";

describe("mobile API request timeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an actionable error instead of leaving a request pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    await expect(fetchWithTimeout("https://example.test", {}, 10)).rejects.toMatchObject({
      message: requestTimeoutMessage,
      name: "RequestTimeoutError",
    });
  });
});
