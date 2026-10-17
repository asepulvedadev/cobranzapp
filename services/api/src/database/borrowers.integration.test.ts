import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password.js";
import { createPostgresBorrowerService } from "../borrowers/postgres-borrower-service.js";
import { createPostgresCreditService } from "../credit/postgres-credit-service.js";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)("PostgreSQL borrower dossier", () => {
  const developerId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const suffix = Date.now().toString(36);
  const documentNumber = Date.now().toString().slice(-10);
  const formattedDocumentNumber = `${documentNumber.slice(0, 1)}.${documentNumber.slice(1, 4)}.${documentNumber.slice(4, 7)}.${documentNumber.slice(7)}`;
  let runtimePool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    runtimePool = new pg.Pool({ connectionString: runtimeUrl });
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    const passwordHash = await hashPassword("borrower-integration-password");
    await ownerPool.query(
      `INSERT INTO users (id, username, email, display_name, password_hash, platform_role, must_change_password)
       VALUES ($1, $2, $3, 'Borrower Owner', $4, NULL, false)`,
      [
        developerId,
        `borrower-owner-${suffix}`,
        `borrower-owner-${suffix}@example.com`,
        passwordHash,
      ],
    );
    await ownerPool.query(
      `INSERT INTO tenants (id, slug, display_name, created_by, membership_plan)
       VALUES ($1, $2, 'Borrower Tenant', $3, 'pro')`,
      [tenantId, `borrower-tenant-${suffix}`, developerId],
    );
    await ownerPool.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, status, created_by)
       VALUES ($1, $2, 'owner', 'active', $2)`,
      [tenantId, developerId],
    );
  });

  afterAll(async () => {
    if (ownerPool) {
      await ownerPool.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM loan_applications WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM loan_products WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM tenant_memberships WHERE tenant_id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      await ownerPool.query("DELETE FROM users WHERE id = $1", [developerId]);
      await ownerPool.end();
    }
    if (runtimePool) await runtimePool.end();
  });

  it("stores encrypted identity metadata and keeps the full number out of responses", async () => {
    const service = createPostgresBorrowerService(runtimePool, "borrower-test-secret-1234567890");
    const actor = { userId: developerId, platformRole: null, tenantRole: "owner" as const };
    const created = await service.create(actor, tenantId, {
      fullName: "Cliente de Integración",
      country: "CO",
      documentType: "CC",
      documentNumber: formattedDocumentNumber,
      phone: "+57 300 222 3344",
      homeAddress: "Calle 1 # 2-3",
      workAddress: "Carrera 4 # 5-6",
      homeAddressConfirmed: true,
      workAddressConfirmed: true,
      profilePhotoObjectKey: null,
      consentVersion: "borrower-dossier-v1",
      consentEvidenceRef: "formulario-test",
      emergencyContacts: [
        { fullName: "Contacto de Prueba", relationship: "Hermano", phone: "+57 300 999 8877" },
      ],
      documents: [],
      requestId: "borrower-create-test",
    });
    expect(created).toMatchObject({
      status: "created",
      borrower: {
        fullName: "Cliente de Integración",
        identity: { documentType: "CC", documentLast4: documentNumber.slice(-4) },
      },
    });
    if (created.status !== "created") throw new Error("Borrower was not created");
    expect(JSON.stringify(created)).not.toContain(documentNumber);
    await expect(
      service.verifyShared(actor, tenantId, documentNumber, "borrower-verification-test"),
    ).resolves.toMatchObject({
      registered: true,
      fullName: "Cliente de Integración",
      activeCreditCount: 0,
      payerRating: "no_data",
      negativeReport: false,
    });
    const directory = await service.list(actor, tenantId, {
      search: "Cliente",
      page: 1,
      pageSize: 20,
    });
    expect(directory.borrowers).toHaveLength(1);
    const directoryByFullDocument = await service.list(actor, tenantId, {
      search: formattedDocumentNumber,
      page: 1,
      pageSize: 20,
    });
    expect(directoryByFullDocument.borrowers).toHaveLength(1);
    const directoryByPhone = await service.list(actor, tenantId, {
      search: "3002223344",
      page: 1,
      pageSize: 20,
    });
    expect(directoryByPhone.borrowers).toHaveLength(1);
    await expect(
      service.reportCollection(actor, tenantId, created.borrower.id, {
        reason: "unreachable",
        followUpDate: null,
        notes: "No fue posible localizar al cliente.",
        requestId: "borrower-collection-report-test",
      }),
    ).resolves.toMatchObject({ status: "created", report: { reason: "unreachable" } });
    await expect(
      service.verifyShared(actor, tenantId, documentNumber, "borrower-adverse-verification-test"),
    ).resolves.toMatchObject({ registered: true, payerRating: "low", negativeReport: true });
    await expect(service.get(actor, tenantId, created.borrower.id)).resolves.toMatchObject({
      id: created.borrower.id,
      phone: "+57 300 222 3344",
    });
    await expect(
      service.create(actor, tenantId, {
        fullName: "Cliente Duplicado",
        country: "CO",
        documentType: "CC",
        documentNumber,
        phone: "+57 300 111 0000",
        homeAddress: "Calle 1 # 2-3",
        workAddress: "Carrera 4 # 5-6",
        homeAddressConfirmed: true,
        workAddressConfirmed: true,
        profilePhotoObjectKey: null,
        consentVersion: "borrower-dossier-v1",
        consentEvidenceRef: "formulario-test-2",
        emergencyContacts: [
          { fullName: "Contacto de Prueba", relationship: "Hermano", phone: "+57 300 999 8877" },
        ],
        documents: [],
        requestId: "borrower-create-duplicate-test",
      }),
    ).resolves.toEqual({ status: "duplicate_identity" });

    const creditService = createPostgresCreditService(
      runtimePool,
      "borrower-public-link-secret-1234567890",
      "https://example.test",
    );
    const product = await creditService.createProduct(actor, tenantId, {
      name: "Crédito de integración",
      principalMin: "1",
      principalMax: "500000",
      termCount: 30,
      paymentFrequency: "daily",
      rateBasis: "flat_total",
      nominalRate: "20",
      documentationFeeRate: "0",
      complianceSourceRef: "integration-test",
      requestId: "credit-product-create-test",
    });
    expect(product.status).toBe("created");
    if (product.status !== "created") throw new Error("Loan product was not created");
    await expect(
      creditService.createApplication(actor, tenantId, {
        borrowerId: created.borrower.id,
        loanProductId: product.product.id,
        requestedPrincipal: "400000",
        paymentFrequency: "daily",
        requestedTermCount: 30,
        purpose: null,
        requestId: "unverified-loan-application-test",
      }),
    ).resolves.toEqual({ status: "borrower_not_verified" });

    const documentKeyPrefix = `tenant/${tenantId}/borrowers/${created.borrower.id}/quarantine`;
    await expect(
      service.addDocument(actor, tenantId, created.borrower.id, {
        category: "identity",
        side: "front",
        objectKey: `${documentKeyPrefix}/front.jpg`,
        mediaType: "image/jpeg",
        sizeBytes: 1024,
        sha256: "a".repeat(64),
        requestId: "borrower-identity-front-upload-test",
      }),
    ).resolves.toMatchObject({
      status: "created",
      document: { category: "identity", side: "front" },
    });
    await expect(
      service.addDocument(actor, tenantId, created.borrower.id, {
        category: "profile_photo",
        side: null,
        objectKey: `${documentKeyPrefix}/selfie.jpg`,
        mediaType: "image/jpeg",
        sizeBytes: 1024,
        sha256: "b".repeat(64),
        requestId: "borrower-selfie-upload-test",
      }),
    ).resolves.toMatchObject({
      status: "created",
      document: { category: "profile_photo", side: null },
    });
    const reviewed = await service.review(actor, tenantId, created.borrower.id, {
      decision: "reviewed",
      notes: "La revisión manual coincide con la evidencia cargada.",
      legalNameConfirmed: true,
      identityFrontConfirmed: true,
      identityBackConfirmed: false,
      profilePhotoConfirmed: true,
      requestId: "borrower-review-test",
    });
    expect(reviewed).toMatchObject({
      status: "updated",
      borrower: {
        identity: { verificationState: "reviewed" },
        documents: expect.arrayContaining([
          expect.objectContaining({ category: "identity", side: "front", scanStatus: "accepted" }),
          expect.objectContaining({ category: "profile_photo", scanStatus: "accepted" }),
        ]),
      },
    });
    const application = await creditService.createApplication(actor, tenantId, {
      borrowerId: created.borrower.id,
      loanProductId: product.product.id,
      requestedPrincipal: "400000",
      paymentFrequency: "daily",
      requestedTermCount: 30,
      purpose: null,
      requestId: "loan-application-create-test",
    });
    expect(application).toMatchObject({
      status: "created",
      application: { requestedPrincipal: "400000.00", status: "active" },
    });
    if (application.status !== "created") throw new Error("Loan application was not created");
    const payment = await creditService.recordPayment(actor, tenantId, application.application.id, {
      installmentNumber: 1,
      amount:
        application.application.nextPaymentAmount ?? application.application.installmentAmount,
      paymentMethod: "cash",
      requestId: "loan-payment-create-test",
    });
    expect(payment).toMatchObject({
      status: "recorded",
      payment: {
        installmentNumber: 1,
        paymentMethod: "cash",
        remainingAmount: expect.any(String),
        receiptUrl: expect.stringContaining("https://example.test/recibo/"),
      },
    });
    if (payment.status !== "recorded") throw new Error("Loan payment was not recorded");
    await expect(
      creditService.getPublicPaymentReceipt(payment.payment.receiptUrl.split("/recibo/")[1] ?? ""),
    ).resolves.toMatchObject({
      status: "found",
      receipt: {
        borrower: { fullName: "Cliente de Integración" },
        payment: { receiptNumber: payment.payment.receiptNumber },
      },
    });
    const portalLink = await creditService.rotateBorrowerPortalLink(
      actor,
      tenantId,
      created.borrower.id,
      "borrower-portal-create-test",
    );
    expect(portalLink).toMatchObject({
      status: "found",
      active: true,
      url: expect.stringContaining("https://example.test/cliente/"),
    });
    if (portalLink.status !== "found") throw new Error("Borrower portal was not created");
    await expect(
      creditService.getPublicBorrowerPortal(portalLink.url.split("/cliente/")[1] ?? ""),
    ).resolves.toMatchObject({
      status: "found",
      profile: {
        borrower: { fullName: "Cliente de Integración" },
        credits: [{ paidInstallments: 1 }],
        payments: [{ receiptNumber: payment.payment.receiptNumber }],
      },
    });
    const applicationAudit = await ownerPool.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_events
        WHERE tenant_id = $1 AND request_id = 'loan-application-create-test'`,
      [tenantId],
    );
    expect(applicationAudit.rows[0]?.metadata).toMatchObject({
      status: "active",
      actorRole: "owner",
      requestedPrincipal: 400000,
      nominalRate: 20,
    });
  });
});
