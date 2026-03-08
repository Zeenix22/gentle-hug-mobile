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
