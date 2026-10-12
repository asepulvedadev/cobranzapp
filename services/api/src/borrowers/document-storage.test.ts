import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalBorrowerDocumentStorage } from "./document-storage.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("private borrower document storage", () => {
  it("writes a validated file to a tenant-scoped quarantine key", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cobranzapp-documents-"));
    roots.push(root);
    const storage = createLocalBorrowerDocumentStorage(root);
    const result = await storage.quarantine({
      tenantId: "tenant-1",
      borrowerId: "borrower-1",
      category: "identity",
      side: "front",
      mediaType: "image/png",
      bytes: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    expect(result.objectKey).toMatch(/^tenant\/tenant-1\/borrowers\/borrower-1\/quarantine\//);
    await expect(readFile(path.join(root, result.objectKey))).resolves.toEqual(
      Buffer.from("89504e470d0a1a0a", "hex"),
    );
    await storage.remove(result.objectKey);
    await expect(readFile(path.join(root, result.objectKey))).rejects.toThrow();
  });

  it("rejects a MIME/content mismatch and traversal key is never accepted", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cobranzapp-documents-"));
    roots.push(root);
    const storage = createLocalBorrowerDocumentStorage(root);
    await expect(
      storage.quarantine({
        tenantId: "tenant-1",
        borrowerId: "borrower-1",
        category: "profile_photo",
        side: null,
        mediaType: "image/png",
        bytes: Buffer.from("not-a-png"),
      }),
    ).rejects.toThrow("DOCUMENT_CONTENT_INVALID");
    await expect(storage.remove("../../outside")).rejects.toThrow("INVALID_DOCUMENT_OBJECT_KEY");
  });
});
