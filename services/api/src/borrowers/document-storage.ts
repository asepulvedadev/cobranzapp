import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const maxDocumentSize = 10_485_760;
const allowedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type BorrowerDocumentCategory = "identity" | "profile_photo";
export type BorrowerDocumentSide = "front" | "back" | null;

export type QuarantineDocumentInput = {
  tenantId: string;
  borrowerId: string;
  category: BorrowerDocumentCategory;
  side: BorrowerDocumentSide;
  mediaType: string;
  bytes: Buffer;
};

export type QuarantinedDocument = {
  objectKey: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
};

export interface BorrowerDocumentStorage {
  quarantine(input: QuarantineDocumentInput): Promise<QuarantinedDocument>;
  remove(objectKey: string): Promise<void>;
}

function hasMagic(bytes: Buffer, mediaType: string) {
  if (mediaType === "image/jpeg")
    return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mediaType === "image/png")
    return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mediaType === "application/pdf") return bytes.subarray(0, 4).toString("ascii") === "%PDF";
  if (mediaType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

function safeObjectPath(root: string, objectKey: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedObject = path.resolve(resolvedRoot, objectKey);
  if (resolvedObject !== resolvedRoot && !resolvedObject.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("INVALID_DOCUMENT_OBJECT_KEY");
  }
  return resolvedObject;
}

export function createLocalBorrowerDocumentStorage(root: string): BorrowerDocumentStorage {
  return {
    async quarantine(input) {
      if (!allowedMediaTypes.has(input.mediaType)) throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
      if (input.bytes.length < 1 || input.bytes.length > maxDocumentSize) {
        throw new Error("DOCUMENT_SIZE_INVALID");
      }
      if (input.category === "profile_photo" && input.side !== null) {
        throw new Error("PROFILE_PHOTO_SIDE_INVALID");
      }
      if (input.category === "identity" && input.side === null) {
        throw new Error("IDENTITY_DOCUMENT_SIDE_REQUIRED");
      }
      if (input.category === "profile_photo" && input.mediaType === "application/pdf") {
        throw new Error("PROFILE_PHOTO_TYPE_INVALID");
      }
      if (!hasMagic(input.bytes, input.mediaType)) throw new Error("DOCUMENT_CONTENT_INVALID");

      const objectKey = `tenant/${input.tenantId}/borrowers/${input.borrowerId}/quarantine/${randomUUID()}.bin`;
      const filePath = safeObjectPath(root, objectKey);
      await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
      await writeFile(filePath, input.bytes, { flag: "wx", mode: 0o600 });
      return {
        objectKey,
        mediaType: input.mediaType,
        sizeBytes: input.bytes.length,
        sha256: createHash("sha256").update(input.bytes).digest("hex"),
      };
    },

    async remove(objectKey) {
      await rm(safeObjectPath(root, objectKey), { force: true });
    },
  };
}

export const borrowerDocumentUploadLimits = {
  fileSize: maxDocumentSize,
  files: 1,
  fields: 3,
};
