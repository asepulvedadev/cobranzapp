import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies the right password and rejects a different one", async () => {
    const encoded = await hashPassword("una-clave-segura-2026");

    await expect(verifyPassword("una-clave-segura-2026", encoded)).resolves.toBe(true);
    await expect(verifyPassword("otra-clave-segura-2026", encoded)).resolves.toBe(false);
  });

  it("uses a unique salt for every hash", async () => {
    const first = await hashPassword("una-clave-segura-2026");
    const second = await hashPassword("una-clave-segura-2026");

    expect(first).not.toBe(second);
  });

  it("rejects passwords shorter than the security baseline", async () => {
    await expect(hashPassword("muy-corta")).rejects.toThrow(/12/);
  });
});
