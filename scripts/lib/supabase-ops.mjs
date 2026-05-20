const REQUIRED_DEPLOY_ENV = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TURNSTILE_SECRET",
  "ADMIN_BOOTSTRAP_EMAIL",
  "VITE_TURNSTILE_SITE_KEY",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBaseUrl(value) {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
}

export function validateDeployEnv(env) {
  const errors = [];

  for (const key of REQUIRED_DEPLOY_ENV) {
    if (!String(env[key] ?? "").trim()) {
      errors.push(`${key} is required`);
    }
  }

  const appEnv = String(env.APP_ENV || env.ENVIRONMENT || env.NODE_ENV || "").trim();
  if (!["production", "staging"].includes(appEnv)) {
    errors.push("APP_ENV, ENVIRONMENT, or NODE_ENV must be production or staging");
  }

  if (
    String(env.ALLOW_TURNSTILE_BYPASS ?? "")
      .trim()
      .toLowerCase() === "true"
  ) {
    errors.push("ALLOW_TURNSTILE_BYPASS must not be true for staging/production deploys");
  }

  if (env.ADMIN_BOOTSTRAP_EMAIL && !EMAIL_RE.test(String(env.ADMIN_BOOTSTRAP_EMAIL).trim())) {
    errors.push("ADMIN_BOOTSTRAP_EMAIL must be a valid email address");
  }

  const supabaseUrl = normalizeBaseUrl(env.SUPABASE_URL);
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.push("SUPABASE_URL must be an HTTP(S) URL");
      }
    } catch {
      errors.push("SUPABASE_URL must be a valid URL");
    }
  }

  return errors;
}

function readAutoconfirm(settings) {
  const fields = [
    settings?.autoconfirm,
    settings?.mailer_autoconfirm,
    settings?.external?.email?.autoconfirm,
    settings?.mailer?.autoconfirm,
  ];
  return fields.find((value) => typeof value === "boolean");
}

export function assertEmailConfirmationEnabled(settings) {
  const autoconfirm = readAutoconfirm(settings);
  if (autoconfirm === false) return;
  if (autoconfirm === true) {
    throw new Error("Supabase Auth email confirmation is disabled (autoconfirm=true)");
  }
  throw new Error(
    "Supabase Auth settings did not include autoconfirm or mailer_autoconfirm; cannot verify email confirmation",
  );
}

export async function fetchSupabaseAuthSettings({
  supabaseUrl,
  publishableKey,
  timeoutMs = 10000,
}) {
  const url = `${normalizeBaseUrl(supabaseUrl)}/auth/v1/settings`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Supabase Auth settings probe failed with HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
    );
  }

  return response.json();
}

export async function assertSupabaseEmailConfirmation({ supabaseUrl, publishableKey }) {
  const settings = await fetchSupabaseAuthSettings({ supabaseUrl, publishableKey });
  assertEmailConfirmationEnabled(settings);
  return settings;
}

export async function probeAnonResponseWrite({ supabaseUrl, publishableKey }) {
  const url = `${normalizeBaseUrl(supabaseUrl)}/rest/v1/responses`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      survey_slug: "phase-6-db-smoke",
      language: "en",
      consent: {},
      answers: {},
      progress_pct: 0,
      user_agent: "survey-spark-smoke-db",
    }),
    signal: AbortSignal.timeout(10000),
  });

  const body = await response.text().catch(() => "");
  return { status: response.status, ok: response.ok, body };
}
