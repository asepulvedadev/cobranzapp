import { afterEach, describe, expect, it, vi } from "vitest";
import { createHermesIdentityExtractor } from "./index.js";

afterEach(() => vi.restoreAllMocks());

describe("Hermes identity extractor", () => {
  it("parses the structured Hermes response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  fields: {
                    firstNames: "ANA MARIA",
                    lastNames: "PEREZ LOPEZ",
                    fullName: "ANA MARIA PEREZ LOPEZ",
                    documentNumber: "1.234.567.890",
                    documentType: "CÉDULA DE CIUDADANÍA",
                    country: "Colombia",
                    nationality: "COL",
                    birthDate: "1990-01-02",
                    birthPlace: "BOGOTA",
                    sex: "F",
                    height: "1.65",
                    bloodType: "O+",
                    issueDate: "2010-03-04",
                    issuePlace: "BOGOTA",
                    expirationDate: "2030-03-04",
                    serialNumber: null,
                    mrzLines: [],
                    barcodeData: null,
                  },
                  confidence: 0.96,
                  warnings: [],
                  sources: { front: true, back: false },
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const extractor = createHermesIdentityExtractor({
      apiKey: "secret",
      endpoint: "http://hermes.test/v1/chat/completions",
    });
    const result = await extractor.extract({
      front: { bytes: Buffer.from("image"), mediaType: "image/jpeg", side: "front" },
    });
    expect(result.fields.documentNumber).toBe("1234567890");
    expect(result.fields.documentType).toBe("CC");
    expect(result.fields.country).toBe("CO");
    expect(result.fields.birthPlace).toBe("BOGOTA");
  });

  it("rejects malformed model output", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
        status: 200,
      }),
    );
    const extractor = createHermesIdentityExtractor({
      apiKey: "secret",
      endpoint: "http://hermes.test/v1/chat/completions",
    });
    await expect(
      extractor.extract({
        front: { bytes: Buffer.from("image"), mediaType: "image/jpeg", side: "front" },
      }),
    ).rejects.toThrow("HERMES_OCR_INVALID_RESPONSE");
  });
});
