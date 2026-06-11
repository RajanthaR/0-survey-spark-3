export type InitialLang = "en" | "si" | "ta";

const LANG_COOKIE = "eip.lang";
type EnvRecord = Record<string, unknown>;

function envString(env: EnvRecord, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
}

function isProductionEnv(env: EnvRecord): boolean {
  return (
    envString(env, "APP_ENV") === "production" ||
    envString(env, "ENVIRONMENT") === "production" ||
    envString(env, "NODE_ENV") === "production" ||
    (envString(env, "CF_PAGES") === "1" && envString(env, "CF_PAGES_BRANCH") === "main")
  );
}

export function assertProductionSecurityConfig(env: EnvRecord = process.env): void {
  if (!isProductionEnv(env)) return;
  // Explicit operator kill-switch. When Turnstile is intentionally disabled,
  // waive *only* the secret requirement so the service can boot without it.
  // This is deliberate and reversible (unset TURNSTILE_DISABLED to restore bot
  // protection). All other production invariants below still apply — the
  // disable flag must not become a blanket skip of future security checks.
  if (envString(env, "TURNSTILE_DISABLED") === "true") {
    console.warn(
      "[security] TURNSTILE_DISABLED=true in production — Cloudflare bot protection is OFF.",
    );
  } else if (!envString(env, "TURNSTILE_SECRET")) {
    throw new Error("TURNSTILE_SECRET required in production");
  }
  if (envString(env, "ALLOW_TURNSTILE_BYPASS") === "true") {
    throw new Error("ALLOW_TURNSTILE_BYPASS must not be true in production");
  }
  if (!envString(env, "REDIS_URL")) {
    if (envString(env, "ALLOW_IN_MEMORY_RATE_LIMIT") === "true") {
      console.warn(
        "[security] ALLOW_IN_MEMORY_RATE_LIMIT=true in production - Redis-backed rate limiting is OFF.",
      );
    } else {
      throw new Error("REDIS_URL required in production");
    }
  }
}

export function readInitialLang(cookieHeader: string | null): InitialLang {
  if (!cookieHeader) return "en";
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== LANG_COOKIE) continue;
    let value: string;
    try {
      value = decodeURIComponent(rawValue.join("="));
    } catch {
      return "en";
    }
    if (value === "si" || value === "ta" || value === "en") return value;
  }
  return "en";
}

export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === "function") return btoa(binary);
  const buffer = (
    globalThis as typeof globalThis & {
      Buffer?: { from(input: Uint8Array): { toString(encoding: "base64"): string } };
    }
  ).Buffer;
  if (buffer) return buffer.from(bytes).toString("base64");
  throw new Error("No base64 encoder available for CSP nonce generation");
}

function supabaseConnectSources(env: EnvRecord): string[] | undefined {
  const rawUrl = envString(env, "VITE_SUPABASE_URL") || envString(env, "SUPABASE_URL");
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const apiScheme = url.protocol === "http:" ? "http" : "https";
    const realtimeScheme = url.protocol === "http:" ? "ws" : "wss";
    return [`${apiScheme}://${url.host}`, `${realtimeScheme}://${url.host}`];
  } catch {
    return undefined;
  }
}

function connectSrc(env: EnvRecord): string {
  const supabaseSources = supabaseConnectSources(env);
  if (!supabaseSources) {
    // Build/preview paths may not expose Supabase env when SSR headers are built;
    // keep HTTPS/WSS broad rather than breaking auth, API calls, or realtime.
    return "connect-src 'self' https: wss: https://challenges.cloudflare.com";
  }
  return ["connect-src 'self'", ...supabaseSources, "https://challenges.cloudflare.com"].join(" ");
}

export function buildContentSecurityPolicy(nonce: string, env: EnvRecord = process.env): string {
  const script = `'nonce-${nonce}'`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `script-src 'self' ${script} https://challenges.cloudflare.com`,
    `script-src-elem 'self' ${script} https://challenges.cloudflare.com`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "child-src 'self' https://challenges.cloudflare.com blob:",
    connectSrc(env),
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}

export function applySecurityHeaders(
  headers: Headers,
  nonce: string,
  env: EnvRecord = process.env,
): void {
  const csp = buildContentSecurityPolicy(nonce, env);
  headers.set("Content-Security-Policy", csp);
  headers.delete("Content-Security-Policy-Report-Only");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", "),
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
}
