const AES_KEY_SIZE_BYTES = 32;
const JWE_IV_SIZE_BYTES = 12;
const TAG_SIZE_BYTES = 16;
const BODY_FIELD_NAME = "data";

export interface EncryptPayloadOptions {
  payload: string;
  publicKeyText: string;
  minifyJson: boolean;
}

export interface EncryptPayloadResult {
  xKey: string;
  bodyText: string;
  payload: string;
}

export interface DecryptPayloadOptions {
  xKeyText: string;
  bodyText: string;
  privateKeyText: string;
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available");
  }
  return globalThis.crypto;
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string, fieldName: string): Uint8Array {
  const normalized = String(value || "").replace(/\s+/g, "");
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (error) {
    throw new Error(`${fieldName} must be standard base64`);
  }
}

function base64UrlNoPad(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string, fieldName: string): Uint8Array {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return base64ToBytes(padded, fieldName);
}

function normalizePublicKey(publicKeyText: string): string {
  return String(publicKeyText || "")
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
}

function normalizePrivateKey(privateKeyText: string): string {
  return String(privateKeyText || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
}

async function importPublicKey(publicKeyText: string): Promise<CryptoKey> {
  const publicKeyBytes = base64ToBytes(normalizePublicKey(publicKeyText), "RSA public key");
  return cryptoApi().subtle.importKey(
    "spki",
    publicKeyBytes,
    { name: "RSA-OAEP", hash: "SHA-1" },
    false,
    ["encrypt"]
  );
}

async function importPrivateKey(privateKeyText: string): Promise<CryptoKey> {
  const privateKeyBytes = base64ToBytes(normalizePrivateKey(privateKeyText), "RSA private key");
  return cryptoApi().subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "RSA-OAEP", hash: "SHA-1" },
    false,
    ["decrypt"]
  );
}

function normalizePayload(payload: string, minifyJson: boolean): string {
  const value = String(payload || "");
  if (!value.trim()) {
    throw new Error("Plain payload is required");
  }
  if (!minifyJson) {
    return value;
  }
  return JSON.stringify(JSON.parse(value));
}

function createAesKeyBytes(): Uint8Array {
  const aesKey = new Uint8Array(AES_KEY_SIZE_BYTES);
  cryptoApi().getRandomValues(aesKey);
  return aesKey;
}

async function buildXKey(aesKeyBytes: Uint8Array, publicKeyText: string): Promise<string> {
  const publicKey = await importPublicKey(publicKeyText);
  const aesKeyText = bytesToBase64(aesKeyBytes);
  const encryptedKey = await cryptoApi().subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    textToBytes(aesKeyText)
  );
  return bytesToBase64(new Uint8Array(encryptedKey));
}

function normalizeXKey(xKeyText: string): string {
  return String(xKeyText || "")
    .replace(/^x-key\s*:\s*/i, "")
    .trim();
}

async function decryptXKey(xKeyText: string, privateKeyText: string): Promise<Uint8Array> {
  const privateKey = await importPrivateKey(privateKeyText);
  const encryptedKey = base64ToBytes(normalizeXKey(xKeyText), "x-key");
  const aesKeyTextBytes = await cryptoApi().subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedKey
  );
  const aesKey = base64ToBytes(bytesToText(new Uint8Array(aesKeyTextBytes)), "decrypted AES key");
  if (aesKey.length !== AES_KEY_SIZE_BYTES) {
    throw new Error(`Decrypted AES key must be ${AES_KEY_SIZE_BYTES} bytes`);
  }
  return aesKey;
}

async function encryptJwe(plaintext: string, aesKeyBytes: Uint8Array): Promise<string> {
  const protectedHeader = JSON.stringify({ alg: "dir", enc: "A256GCM" });
  const protectedSegment = base64UrlNoPad(textToBytes(protectedHeader));
  const iv = new Uint8Array(JWE_IV_SIZE_BYTES);
  cryptoApi().getRandomValues(iv);

  const cryptoKey = await cryptoApi().subtle.importKey(
    "raw",
    aesKeyBytes,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const encrypted = new Uint8Array(await cryptoApi().subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textToBytes(protectedSegment),
      tagLength: TAG_SIZE_BYTES * 8,
    },
    cryptoKey,
    textToBytes(plaintext)
  ));
  const ciphertext = encrypted.slice(0, encrypted.length - TAG_SIZE_BYTES);
  const tag = encrypted.slice(encrypted.length - TAG_SIZE_BYTES);

  return [
    protectedSegment,
    "",
    base64UrlNoPad(iv),
    base64UrlNoPad(ciphertext),
    base64UrlNoPad(tag),
  ].join(".");
}

async function decryptJwe(encryptedJwe: string, aesKeyBytes: Uint8Array): Promise<string> {
  const segments = String(encryptedJwe || "").trim().split(".");
  if (segments.length !== 5 || segments[1] !== "") {
    throw new Error("Encrypted payload must be compact JWE with five segments");
  }

  const protectedSegment = segments[0];
  const iv = base64UrlToBytes(segments[2], "JWE IV");
  const ciphertext = base64UrlToBytes(segments[3], "JWE ciphertext");
  const tag = base64UrlToBytes(segments[4], "JWE tag");
  const encrypted = new Uint8Array(ciphertext.length + tag.length);
  encrypted.set(ciphertext);
  encrypted.set(tag, ciphertext.length);

  const cryptoKey = await cryptoApi().subtle.importKey(
    "raw",
    aesKeyBytes,
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const plaintext = await cryptoApi().subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textToBytes(protectedSegment),
      tagLength: TAG_SIZE_BYTES * 8,
    },
    cryptoKey,
    encrypted
  );
  return bytesToText(new Uint8Array(plaintext));
}

function buildBody(encryptedJwe: string): string {
  return JSON.stringify({ [BODY_FIELD_NAME]: encryptedJwe });
}

function extractEncryptedJwe(bodyText: string): string {
  const value = String(bodyText || "").trim();
  if (!value) {
    throw new Error("Encrypted payload is required");
  }
  if (!value.startsWith("{")) {
    return value;
  }
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed[BODY_FIELD_NAME] !== "string") {
    throw new Error('Encrypted payload JSON must contain a string field named "data"');
  }
  return parsed[BODY_FIELD_NAME];
}

export async function encryptPayload(
  options: EncryptPayloadOptions
): Promise<EncryptPayloadResult> {
  const payload = normalizePayload(options.payload, options.minifyJson);
  const aesKey = createAesKeyBytes();
  const xKey = await buildXKey(aesKey, options.publicKeyText);
  const encryptedJwe = await encryptJwe(payload, aesKey);
  return {
    xKey,
    bodyText: buildBody(encryptedJwe),
    payload,
  };
}

export async function decryptPayload(options: DecryptPayloadOptions): Promise<string> {
  const encryptedJwe = extractEncryptedJwe(options.bodyText);
  const aesKey = await decryptXKey(options.xKeyText, options.privateKeyText);
  return decryptJwe(encryptedJwe, aesKey);
}
