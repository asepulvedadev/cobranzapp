import type { Borrower } from "@cobranzapp/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReauthenticationProvider } from "../../ReauthenticationProvider";
import { BorrowerReviewControl } from "./BorrowerReviewControl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const borrower: Borrower = {
  id: "2a1eeaa6-50b3-470d-b708-067207aacddd",
  fullName: "Cliente pendiente",
  status: "active",
  phone: "3005551212",
  whatsappPhone: "3005551212",
  homeAddress: "Calle 10 # 2-20",
  workAddress: "Carrera 4 # 8-15",
  homeAddressStatus: "confirmed",
  workAddressStatus: "confirmed",
  addressLocations: {
    home: {
      status: "pending",
      latitude: null,
      longitude: null,
      formattedAddress: null,
      provider: null,
      precision: null,
      errorCode: null,
      geocodedAt: null,
    },
    work: {
      status: "pending",
      latitude: null,
      longitude: null,
      formattedAddress: null,
      provider: null,
      precision: null,
      errorCode: null,
      geocodedAt: null,
    },
  },
  profilePhotoObjectKey: "private/selfie",
  assignedCollectorId: null,
  assignedCollectorName: null,
  consentVersion: "2026-01",
  identity: {
    country: "CO",
    documentType: "CC",
    documentLast4: "7890",
    verificationState: "manual_pending",
  },
  emergencyContacts: [],
  documents: [
    {
      id: "73d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
      category: "profile_photo",
      side: null,
      objectKey: "private/selfie",
      mediaType: "image/jpeg",
      sizeBytes: 1024,
      sha256: "a".repeat(64),
      scanStatus: "pending",
      createdAt: "2026-10-16T12:00:00.000Z",
    },
    {
      id: "83d33f0e-b1a8-4a55-9061-2ccf283ce0f6",
      category: "identity",
      side: "front",
      objectKey: "private/front",
      mediaType: "image/jpeg",
      sizeBytes: 2048,
      sha256: "b".repeat(64),
      scanStatus: "pending",
      createdAt: "2026-10-16T12:00:00.000Z",
    },
  ],
  createdAt: "2026-10-16T12:00:00.000Z",
};

describe("BorrowerReviewControl", () => {
  it("keeps the approval action visible while uploaded evidence awaits review", () => {
    const html = renderToStaticMarkup(
      <ReauthenticationProvider username="supervisor">
        <BorrowerReviewControl borrower={borrower} canReview tenantId="tenant-id" />
      </ReauthenticationProvider>,
    );

    expect(html).toContain("Por revisar");
    expect(html).toContain("Al aprobar, el frente y la selfie marcados quedarán revisados.");
    expect(html).toContain('class="review-approve-button"');
    expect(html).toContain("Aprobar cliente");
  });

  it("names the exact missing evidence instead of showing a generic approval error", () => {
    const html = renderToStaticMarkup(
      <ReauthenticationProvider username="supervisor">
        <BorrowerReviewControl
          borrower={{
            ...borrower,
            documents: borrower.documents.filter(
              (document) => document.category === "profile_photo",
            ),
          }}
          canReview
          tenantId="tenant-id"
        />
      </ReauthenticationProvider>,
    );

    expect(html).toContain("Falta cargar el frente de la cédula");
    expect(html).toContain("Usa “Agregar documento” antes de aprobar");
    expect(html).toMatch(/review-approve-button[^>]*disabled/);
  });
});
