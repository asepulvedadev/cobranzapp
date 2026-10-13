import { describe, expect, it } from "vitest";
import { extractOcrFields } from "./outbox.js";

describe("borrower OCR field extraction", () => {
  it("normalizes Colombian identity labels and extracts number and name", () => {
    const result = extractOcrFields(
      "REPÚBLICA DE COLOMBIA\nNOMBRES: ANA MARÍA\nAPELLIDOS: PÉREZ GÓMEZ\nCC 1.234.567.890",
    );
    expect(result.fields).toMatchObject({
      fullName: "ANA MARIA PEREZ GOMEZ",
      documentNumber: "1234567890",
      country: "CO",
      documentType: "CC",
    });
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("does not invent a document number when OCR only sees short numbers", () => {
    const result = extractOcrFields("NOMBRES: LUZ ELENA\nFECHA 12/03/24");
    expect(result.fields.documentNumber).toBeNull();
    expect(result.fields.fullName).toBe("LUZ ELENA");
  });
});
