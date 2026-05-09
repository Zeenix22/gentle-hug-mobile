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
