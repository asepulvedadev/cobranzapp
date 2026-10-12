import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password.js";
import { createPostgresBorrowerService } from "../borrowers/postgres-borrower-service.js";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;

describe.skipIf(!runtimeUrl || !ownerUrl)("PostgreSQL borrower dossier", () => {
  const developerId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const suffix = Date.now().toString(36);
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
      documentNumber: "1.234.567.890",
      phone: "+57 300 222 3344",
      homeAddress: "Calle 1 # 2-3",
      workAddress: "Carrera 4 # 5-6",
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
        identity: { documentType: "CC", documentLast4: "7890" },
      },
    });
    if (created.status !== "created") throw new Error("Borrower was not created");
    expect(JSON.stringify(created)).not.toContain("1234567890");
    const directory = await service.list(actor, tenantId, {
      search: "Cliente",
      page: 1,
      pageSize: 20,
    });
    expect(directory.borrowers).toHaveLength(1);
    await expect(service.get(actor, tenantId, created.borrower.id)).resolves.toMatchObject({
      id: created.borrower.id,
      phone: "+57 300 222 3344",
    });
    await expect(
      service.create(actor, tenantId, {
        fullName: "Cliente Duplicado",
        country: "CO",
        documentType: "CC",
        documentNumber: "1234567890",
        phone: "+57 300 111 0000",
        homeAddress: "Calle 1 # 2-3",
        workAddress: "Carrera 4 # 5-6",
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

    const documentKeyPrefix = `tenant/${tenantId}/borrowers/${created.borrower.id}/documents`;
    for (const document of [
      ["identity", "front", `${documentKeyPrefix}/front`] as const,
      ["identity", "back", `${documentKeyPrefix}/back`] as const,
      ["profile_photo", null, `${documentKeyPrefix}/profile`] as const,
    ]) {
      await ownerPool.query(
        `INSERT INTO borrower_documents
           (tenant_id, borrower_id, category, side, object_key, media_type, size_bytes, sha256, scan_status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'image/jpeg', 1024, repeat('a', 64), 'accepted', $6)`,
        [tenantId, created.borrower.id, document[0], document[1], document[2], developerId],
      );
    }
    const reviewed = await service.review(actor, tenantId, created.borrower.id, {
      decision: "reviewed",
      notes: "La revisión manual coincide con la evidencia cargada.",
      legalNameConfirmed: true,
      identityFrontConfirmed: true,
      identityBackConfirmed: true,
      profilePhotoConfirmed: true,
      requestId: "borrower-review-test",
    });
    expect(reviewed).toMatchObject({
      status: "updated",
      borrower: { identity: { verificationState: "reviewed" } },
    });
  });
});
