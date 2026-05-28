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
  // allow the service to boot without a secret. This is deliberate and
  // reversible (unset TURNSTILE_DISABLED to restore bot protection). When the
  // flag is NOT set, the original production invariants below still apply.
  if (envString(env, "TURNSTILE_DISABLED") === "true") {
    console.warn(
      "[security] TURNSTILE_DISABLED=true in production — Cloudflare bot protection is OFF.",
    );
    return;
  }
  if (!envString(env, "TURNSTILE_SECRET")) {
    throw new Error("TURNSTILE_SECRET required in production");
  }
  if (envString(env, "ALLOW_TURNSTILE_BYPASS") === "true") {
    throw new Error("ALLOW_TURNSTILE_BYPASS must not be true in production");
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

export function buildContentSecurityPolicy(nonce: string): string {
  const script = `'nonce-${nonce}'`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    `script-src 'self' ${script} https://challenges.cloudflare.com`,
    `script-src-elem 'self' ${script} https://challenges.cloudflare.com`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "child-src 'self' https://challenges.cloudflare.com blob:",
    "connect-src 'self' https: wss:",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}

export function applySecurityHeaders(headers: Headers, nonce: string): void {
  const csp = buildContentSecurityPolicy(nonce);
  headers.set("Content-Security-Policy", csp);
  headers.set("Content-Security-Policy-Report-Only", csp);
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
