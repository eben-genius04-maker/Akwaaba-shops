import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

// AES-256-GCM encryption for stores' Paystack secret keys.
// Stored as "v1:<iv>:<tag>:<ciphertext>" (base64). The key never touches the database.

function key(): Buffer {
  const k = Buffer.from(serverEnv.paystackKeysEncryptionKey(), "base64");
  if (k.length !== 32) throw new Error("PAYSTACK_KEYS_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable stored key.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
