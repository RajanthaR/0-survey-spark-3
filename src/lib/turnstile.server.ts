import { getClientIp } from "@/lib/rate-limit.server";

/**
 * Cloudflare Turnstile server-side token verification.
 *
 * Behaviour matrix:
 *   1. `TURNSTILE_SECRET` is unset                     → fail-open (allow + warn).
 *      This is intentional so dev / preview without the secret keeps working
 *      and so a misconfigured production deploy never silently locks out
 *      every respondent. The warning shows up in server logs so the gap is
 *      noticed.
 *   2. `TURNSTILE_SECRET` is set + token missing       → reject (HTTP 4xx-style throw).
 *   3. `TURNSTILE_SECRET` is set + siteverify fails    → reject with the
 *      first error code Cloudflare returned, e.g. `invalid-input-response`,
 *      `timeout-or-duplicate`.
 *   4. `TURNSTILE_SECRET` is set + siteverify succeeds → resolves.
 *
 * Network failure to `challenges.cloudflare.com` is treated as a *reject*
 * (not fail-open) — when the secret is set we trust Cloudflare's verdict
 * and refuse to write rows we can't attest to.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  challenge_ts?: string;
  action?: string;
  cdata?: string;
}

export class TurnstileVerificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TurnstileVerificationError";
    this.code = code;
  }
}

export async function verifyTurnstile(
  token: string | undefined | null,
  opts?: { bypassRequested?: boolean },
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET;
  // Internal preview/dev escape hatch. The client can request a bypass from
  // the consent panel's "Continue anyway" button, but we only honour it when
  // the deploy explicitly opts in via `ALLOW_TURNSTILE_BYPASS=true`. This
  // env var is never set in production — it exists so internal testers on
  // preview can validate the rest of the flow when Cloudflare rejects them
  // (e.g. shared corporate IP, headless browser).
  if (opts?.bypassRequested && process.env.ALLOW_TURNSTILE_BYPASS === "true") {
    console.warn(
      "[turnstile] bypass honoured (ALLOW_TURNSTILE_BYPASS=true). Do NOT enable in production.",
    );
    return;
  }
  if (!secret) {
    // Fail-open: keep the survey usable while the secret is being provisioned.
    console.warn("[turnstile] TURNSTILE_SECRET is not set — skipping verification (fail-open).");
    return;
  }

  if (!token || typeof token !== "string" || token.length < 10 || token.length > 2048) {
    throw new TurnstileVerificationError(
      "missing-input-response",
      "Please complete the human-verification challenge before continuing.",
    );
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  // remoteip is optional but Cloudflare uses it to harden the verdict.
  const ip = getClientIp();
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  let result: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // 10s upper bound — Cloudflare normally answers in <500ms.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new TurnstileVerificationError(
        "siteverify-http-error",
        `Verification service returned HTTP ${res.status}.`,
      );
    }
    result = (await res.json()) as SiteverifyResponse;
  } catch (err) {
    if (err instanceof TurnstileVerificationError) throw err;
    console.error("[turnstile] siteverify network error", err);
    throw new TurnstileVerificationError(
      "siteverify-unreachable",
      "Couldn't reach the verification service. Please try again.",
    );
  }

  if (!result.success) {
    const code = result["error-codes"]?.[0] ?? "unknown-error";
    throw new TurnstileVerificationError(
      code,
      `Verification failed (${code}). Please refresh the challenge and try again.`,
    );
  }
}
