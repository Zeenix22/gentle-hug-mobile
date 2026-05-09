import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-file`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
});

Deno.test("returns 401 without authorization header", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisId: "test" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Missing authorization");
});

Deno.test("rejects invalid auth token", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({ analysisId: "test" }),
  });
  const body = await res.json();
  console.log("Invalid token response:", res.status, body);
  // Should be 401 or 500 (config issue) — not 200/201
  assert(res.status >= 400, `Expected error status, got ${res.status}`);
});

Deno.test("function is deployed and reachable", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test",
    },
    body: JSON.stringify({ analysisId: "test" }),
  });
  const body = await res.text();
  console.log("Reachability check:", res.status, body);
  // Function responds (not 404 = deployed)
  assert(res.status !== 404, "Function should be deployed");
});

// ─── uint8ToBase64 encoding correctness ─────────────────────────────────────
import { uint8ToBase64 } from "./encoding.ts";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

Deno.test("uint8ToBase64: small payload round-trips", () => {
  const input = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  const b64 = uint8ToBase64(input);
  assert(BASE64_RE.test(b64), "must be valid base64");
  assertEquals(Array.from(decodeBase64(b64)), Array.from(input));
});

Deno.test("uint8ToBase64: large payload (>1MB, many chunks) is single valid base64 string", () => {
  // 2.5 MB of pseudo-random bytes — spans hundreds of 8KB chunks
  const size = 2_500_000;
  const input = new Uint8Array(size);
  for (let i = 0; i < size; i++) input[i] = (i * 2654435761) & 0xFF;

  const b64 = uint8ToBase64(input);

  // Must be a single, well-formed base64 string (only trailing '=' padding allowed)
  assert(BASE64_RE.test(b64), "encoded output must be valid base64 with no mid-stream padding");

  // Guard against the regression where each 8KB chunk was encoded separately:
  // independently-encoded chunks would produce many '=' characters (one per chunk
  // boundary that isn't a multiple of 3 bytes). A correctly-encoded stream has
  // at most 2 '=' chars at the very end.
  const padCount = (b64.match(/=/g) || []).length;
  assert(padCount <= 2, `expected ≤2 '=' padding chars, got ${padCount} (chunks encoded separately?)`);
  assert(!b64.slice(0, -2).includes("="), "no '=' padding should appear before the final 2 chars");

  // Round-trip must reproduce the original bytes exactly
  const decoded = decodeBase64(b64);
  assertEquals(decoded.length, size);
  assertEquals(decoded[0], input[0]);
  assertEquals(decoded[size - 1], input[size - 1]);
  assertEquals(decoded[1_234_567], input[1_234_567]);
});

Deno.test("uint8ToBase64: respects maxBytes truncation", () => {
  const input = new Uint8Array(1000).fill(0x41);
  const b64 = uint8ToBase64(input, 100);
  const decoded = decodeBase64(b64);
  assertEquals(decoded.length, 100);
});
