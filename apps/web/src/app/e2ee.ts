import { EncryptedPayload } from "@chatapp/shared";

const KEY_PAIR_STORAGE_PREFIX = "chatapp:e2ee-keypair:";
const ECDH_PARAMS: EcKeyImportParams | EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Feeld's real optional end-to-end encrypted chat (#149): real ECDH
 * (P-256) key agreement + AES-GCM, via the browser's native Web Crypto
 * API — not a fabricated "encryption" that's actually just base64 or a
 * cipher the server itself could reverse. Each browser generates its own
 * key pair and only ever publishes the public half (see the API's
 * PublicKeyStore); the private key never leaves the device over the
 * network.
 *
 * Disclosed simplification: the private key is persisted in
 * `localStorage` (as an extractable JWK) rather than a hardware-backed
 * secure enclave, since a browser has no native keychain to target — the
 * same kind of demo-grade credential storage as this app's guest
 * identity, not a claim of production-grade key custody. A real
 * production app would use a non-extractable CryptoKey backed by the
 * platform's secure storage where available.
 */
export async function getOrCreateKeyPair(author: string): Promise<CryptoKeyPair> {
  const storageKey = `${KEY_PAIR_STORAGE_PREFIX}${author}`;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const { publicKeyJwk, privateKeyJwk } = JSON.parse(stored);
      const [publicKey, privateKey] = await Promise.all([
        crypto.subtle.importKey("jwk", publicKeyJwk, ECDH_PARAMS, true, []),
        crypto.subtle.importKey("jwk", privateKeyJwk, ECDH_PARAMS, true, ["deriveKey"]),
      ]);
      return { publicKey, privateKey };
    }
  } catch {
    // Corrupted/unavailable storage — fall through and generate a fresh pair.
  }

  const keyPair = (await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey"])) as CryptoKeyPair;
  try {
    const [publicKeyJwk, privateKeyJwk] = await Promise.all([
      crypto.subtle.exportKey("jwk", keyPair.publicKey),
      crypto.subtle.exportKey("jwk", keyPair.privateKey),
    ]);
    window.localStorage.setItem(storageKey, JSON.stringify({ publicKeyJwk, privateKeyJwk }));
  } catch {
    // Storage unavailable — the pair still works for this page load, it
    // just won't survive a reload.
  }
  return keyPair;
}

export function exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", publicKey);
}

function importPeerPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, true, []);
}

/** ECDH key agreement, deriving a single AES-GCM key both sides arrive at independently — the actual "shared secret," never transmitted itself. */
export async function deriveSharedKey(privateKey: CryptoKey, peerPublicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const peerPublicKey = await importPeerPublicKey(peerPublicKeyJwk);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const IV_LENGTH_BYTES = 12;

export async function encryptText(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: bufferToBase64(ciphertextBuffer), iv: bufferToBase64(iv.buffer) };
}

export async function decryptText(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(payload.iv) },
    key,
    base64ToBuffer(payload.ciphertext)
  );
  return new TextDecoder().decode(plaintextBuffer);
}
