import type { Borrower } from "@cobranzapp/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CollectorBorrowerCard } from "./CollectorBorrowerCard";

const borrower: Borrower = {
  id: "2a1eeaa6-50b3-470d-b708-067207aacddd",
  fullName: "Laura Walteros",
  status: "active",
  phone: "300 555 1212",
  whatsappPhone: "3005551212",
  homeAddress: "Calle 10 # 2-20, Cartagena",
  workAddress: "Carrera 4 # 8-15, Cartagena",
  homeAddressStatus: "confirmed",
  workAddressStatus: "confirmed",
  addressLocations: {
    home: {
      status: "ready",
      latitude: 10.391,
      longitude: -75.479,
      formattedAddress: "Calle 10 # 2-20, Cartagena",
      provider: "test",
      precision: "rooftop",
      errorCode: null,
      geocodedAt: "2026-10-16T12:00:00.000Z",
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
  profilePhotoObjectKey: null,
  consentVersion: "2026-01",
  identity: {
    country: "CO",
    documentType: "CC",
    documentLast4: "7890",
    verificationState: "reviewed",
  },
  emergencyContacts: [
    {
      id: "64e877f2-38c8-489a-a200-a4d2eaa90885",
      fullName: "Carlos Walteros",
      relationship: "Hermano",
      phone: "3015553434",
    },
  ],
  documents: [
    {
      id: "73d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
      category: "profile_photo",
      side: null,
      objectKey: "private/selfie",
      mediaType: "image/jpeg",
      sizeBytes: 1024,
      sha256: "a".repeat(64),
      scanStatus: "accepted",
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
      scanStatus: "accepted",
      createdAt: "2026-10-16T12:00:00.000Z",
    },
  ],
  createdAt: "2026-10-16T12:00:00.000Z",
};

describe("CollectorBorrowerCard", () => {
  it("prioritizes collector actions and protects the complete identity number", () => {
    const html = renderToStaticMarkup(
      <CollectorBorrowerCard
        borrower={borrower}
        creditHref="/creditos?cliente=2a1eeaa6&amp;nuevo=1"
        documentTools={<span>Agregar documento</span>}
        homeWazeHref="https://waze.example/home"
        onEditAddresses={vi.fn()}
        tenantId="4cde1a7b-46d3-4405-914f-6e4b9aeed985"
        whatsappHref="https://wa.me/573005551212"
        workWazeHref="https://waze.example/work"
      />,
    );

    expect(html).toContain("Laura Walteros");
    expect(html).toContain("•••• 7890");
    expect(html).toContain("Crear crédito");
    expect(html).toContain("Llamar");
    expect(html).toContain("WhatsApp");
    expect(html).toContain("Ver ficha y direcciones");
    expect(html).toContain('aria-label="Ver fotos de Laura Walteros"');
    expect(html).toContain(
      "/api/v1/tenants/4cde1a7b-46d3-4405-914f-6e4b9aeed985/borrowers/2a1eeaa6-50b3-470d-b708-067207aacddd/documents/73d33f0e-b1a8-4a55-9061-2ccf283ce0f5",
    );
    expect(html).toContain("Abrir casa en Waze");
    expect(html).toContain("Abrir trabajo en Waze");
    expect(html).not.toContain("Usar GPS");
    expect(html).not.toContain(">Ubicar<");
    expect(html).not.toContain("1.234.567.890");
  });
});
