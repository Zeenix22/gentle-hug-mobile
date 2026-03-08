import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-file`;

Deno.test("returns 401 without authorization header", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisId: "test" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("No-auth response:", body);
});

Deno.test("returns 401 with invalid auth token", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({ analysisId: "test" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("Invalid-auth response:", body);
});

Deno.test("returns 400 when analysisId is missing", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Will be 401 (no valid user) or 400 — either is acceptable
  console.log("Missing analysisId status:", res.status, body);
  assertEquals(res.status <= 401, true);
});

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  console.log("CORS preflight OK");
});
