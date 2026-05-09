// Convert a Uint8Array to a single, valid base64 string.
//
// IMPORTANT: We must NOT btoa() each chunk independently — doing so injects
// '=' padding at every chunk boundary that isn't a multiple of 3 bytes,
// producing a malformed base64 stream that downstream services (e.g. our
// Python forensics microservice) reject with "Cannot decode image".
//
// Instead, build the binary string in chunks (to avoid call-stack overflow
// on String.fromCharCode(...largeArray)) and call btoa() exactly ONCE.
export function uint8ToBase64(uint8: Uint8Array, maxBytes = 10_000_000): string {
  const CHUNK = 8192;
  const len = Math.min(uint8.length, maxBytes);
  let binary = "";
  for (let i = 0; i < len; i += CHUNK) {
    binary += String.fromCharCode(...uint8.slice(i, Math.min(i + CHUNK, len)));
  }
  return btoa(binary);
}

// Strict standard-base64 alphabet, length multiple of 4, only trailing '=' (≤2).
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export interface Base64Validation {
  ok: boolean;
  reason?: string;
  decodedLength?: number;
}

// Validate a base64 string is well-formed AND round-trips through atob() to
// the expected number of bytes. Catches: malformed alphabet, mid-stream '='
// padding (the chunk-encoding regression), wrong length, and decode failures.
export function validateBase64(b64: string, expectedBytes?: number): Base64Validation {
  if (typeof b64 !== "string" || b64.length === 0) {
    return { ok: false, reason: "empty base64 string" };
  }
  if (b64.length % 4 !== 0) {
    return { ok: false, reason: `length ${b64.length} is not a multiple of 4` };
  }
  if (!BASE64_RE.test(b64)) {
    return { ok: false, reason: "contains characters outside the standard base64 alphabet or has mid-stream '=' padding" };
  }
  let decodedLength: number;
  try {
    decodedLength = atob(b64).length;
  } catch (e) {
    return { ok: false, reason: `atob() decode failed: ${(e as Error).message}` };
  }
  if (expectedBytes != null && decodedLength !== expectedBytes) {
    return { ok: false, reason: `decoded length ${decodedLength} ≠ expected ${expectedBytes}` };
  }
  return { ok: true, decodedLength };
}
