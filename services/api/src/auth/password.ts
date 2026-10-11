import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: MAX_MEMORY },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must contain between 12 and 256 characters");
  }

  const salt = randomBytes(24);
  const derived = await deriveKey(password, salt, KEY_LENGTH);

  return [
    "scrypt",
    `N=${COST},r=${BLOCK_SIZE},p=${PARALLELIZATION}`,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, parameters, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !parameters || !saltValue || !hashValue) return false;

  const parsed = Object.fromEntries(
    parameters.split(",").map((entry) => {
      const [key, value] = entry.split("=");
      return [key, Number(value)];
    }),
  );
  if (parsed.N !== COST || parsed.r !== BLOCK_SIZE || parsed.p !== PARALLELIZATION) return false;

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  if (salt.length !== 24 || expected.length !== KEY_LENGTH) return false;

  const actual = await deriveKey(password, salt, expected.length);

  return timingSafeEqual(actual, expected);
}
