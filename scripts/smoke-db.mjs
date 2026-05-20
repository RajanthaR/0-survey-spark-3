#!/usr/bin/env node
import {
  assertSupabaseEmailConfirmation,
  normalizeBaseUrl,
  probeAnonResponseWrite,
} from "./lib/supabase-ops.mjs";

const errors = [];

function required(key) {
  const value = String(process.env[key] ?? "").trim();
  if (!value) errors.push(`${key} is required`);
  return value;
}

const supabaseUrl = normalizeBaseUrl(required("SUPABASE_URL"));
const publishableKey = required("SUPABASE_PUBLISHABLE_KEY");

if (supabaseUrl) {
  try {
    new URL(supabaseUrl);
  } catch {
    errors.push("SUPABASE_URL must be a valid URL");
  }
}

if (errors.length) {
  console.error("DB smoke failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

try {
  await assertSupabaseEmailConfirmation({ supabaseUrl, publishableKey });
  console.log("✓ Supabase Auth email confirmation is enabled.");
} catch (error) {
  console.error("DB smoke failed:");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

try {
  const result = await probeAnonResponseWrite({ supabaseUrl, publishableKey });
  if (result.ok) {
    console.error("DB smoke failed:");
    console.error(
      `- anon/publishable-key insert into public.responses unexpectedly succeeded with HTTP ${result.status}`,
    );
    process.exit(1);
  }
  if (![401, 403].includes(result.status)) {
    console.error("DB smoke failed:");
    console.error(
      `- anon/publishable-key insert was rejected with HTTP ${result.status}, not the expected RLS/auth 401/403`,
    );
    if (result.body) console.error(`  body: ${result.body.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`✓ anon/publishable-key writes to public.responses are denied (${result.status}).`);
} catch (error) {
  console.error("DB smoke failed:");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
