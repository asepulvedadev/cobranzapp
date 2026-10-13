import { describe, expect, it } from "vitest";
import { formatApiError } from "./api-error";

describe("formatApiError", () => {
  it("keeps the API message and support request id", () => {
    expect(
      formatApiError(
        { error: { message: "No fue posible crear el empleado.", requestId: "req-123" } },
        "Error genérico",
      ),
    ).toBe("No fue posible crear el empleado. Código de soporte: req-123");
  });

  it("uses the fallback when the response is not an API error", () => {
    expect(formatApiError(null, "Inténtalo de nuevo.")).toBe("Inténtalo de nuevo.");
  });
});
