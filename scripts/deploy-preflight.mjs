#!/usr/bin/env node
import {
  assertEmailConfirmationEnabled,
  assertSupabaseEmailConfirmation,
  validateDeployEnv,
} from "./lib/supabase-ops.mjs";

const isStatic = process.argv.includes("--static");

function fail(errors) {
  console.error("Deploy preflight failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

async function runStatic() {
  const fixture = {
    APP_ENV: "production",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    SUPABASE_SERVICE_ROLE_KEY: "sb_service_role_fixture",
    TURNSTILE_SECRET: "turnstile_fixture",
    ADMIN_BOOTSTRAP_EMAIL: "admin@example.com",
    VITE_TURNSTILE_SITE_KEY: "site_key_fixture",
    ALLOW_TURNSTILE_BYPASS: "false",
  };
  const errors = validateDeployEnv(fixture);
  try {
    assertEmailConfirmationEnabled({ autoconfirm: false });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length) return fail(errors);
  console.log("Deploy preflight static fixture passed.");
}

async function runLive() {
  const errors = validateDeployEnv(process.env);
  if (errors.length) return fail(errors);

  try {
    await assertSupabaseEmailConfirmation({
      supabaseUrl: process.env.SUPABASE_URL,
      publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    return fail([error instanceof Error ? error.message : String(error)]);
  }

  console.log("Deploy preflight passed.");
}

if (isStatic) await runStatic();
else await runLive();
