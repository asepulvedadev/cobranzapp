import { describe, expect, it } from "vitest";
import { extractOcrIdentityFields } from "./BorrowerDirectory";

describe("extractOcrIdentityFields", () => {
  it("extracts Colombian identity data from labelled OCR text", () => {
    expect(
      extractOcrIdentityFields(`
        REPUBLICA DE COLOMBIA
        CEDULA DE CIUDADANIA
        APELLIDOS PEREZ GOMEZ
        NOMBRES JUAN CARLOS
        NUIP 1.234.567.890
      `),
    ).toEqual({ fullName: "JUAN CARLOS PEREZ GOMEZ", documentNumber: "1234567890" });
  });

  it("returns empty fields when the image has no reliable identity values", () => {
    expect(extractOcrIdentityFields("REPUBLICA DE COLOMBIA\nCEDULA DE CIUDADANIA")).toEqual({
      fullName: "",
      documentNumber: "",
    });
  });
});
