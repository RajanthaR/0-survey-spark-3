#!/usr/bin/env node
/**
 * Automated SSR smoke test.
 *
 * Fetches a list of routes against a running server (dev, preview, or
 * deployed) and fails if any return a blank screen, a catastrophic h3
 * error envelope, a non-2xx status, or HTML missing the app shell markers.
 *
 * Usage:
 *   BASE_URL=http://localhost:5173 node scripts/smoke-ssr.mjs
 *   node scripts/smoke-ssr.mjs https://survey.example.org
 */

const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:5173").replace(
  /\/$/,
  "",
);

const ROUTES = [
  "/",
  "/s/phase-1",
  "/s/phase-3",
  "/r/smoke-test-token",
  "/admin",
  "/about",
  "/about/study",
  "/about/research",
  "/about/engineering",
  "/about/present",
];

const MIN_HTML_BYTES = 500;

function fail(route, reason, extra = "") {
  console.error(`✗ ${route} — ${reason}${extra ? `\n  ${extra}` : ""}`);
  return false;
}

function checkSecurityHeaders(route, res) {
  const expected = [
    ["strict-transport-security", /max-age=/i],
    ["permissions-policy", /camera=\(\)/i],
    ["referrer-policy", /^strict-origin-when-cross-origin$/i],
    ["x-content-type-options", /^nosniff$/i],
    ["x-frame-options", /^DENY$/i],
  ];

  for (const [header, pattern] of expected) {
    const value = res.headers.get(header) ?? "";
    if (!pattern.test(value)) {
      return fail(route, `missing/invalid ${header}`, value || "(missing)");
    }
  }

  const csp = res.headers.get("content-security-policy") ?? "";
  if (!csp) return fail(route, "missing content-security-policy");
  if (!res.headers.get("content-security-policy-report-only")) {
    return fail(route, "missing content-security-policy-report-only");
  }
  if (!/script-src[^;]*'nonce-[^']+'/.test(csp)) {
    return fail(route, "CSP script-src missing nonce", csp);
  }
  if (/script-src[^;]*'unsafe-inline'/.test(csp)) {
    return fail(route, "CSP script-src still allows unsafe-inline", csp);
  }
  return true;
}

async function check(route) {
  const url = `${BASE}${route}`;
  let res;
  try {
    res = await fetch(url, { headers: { accept: "text/html" }, redirect: "manual" });
  } catch (e) {
    return fail(route, "fetch threw", String(e));
  }

  if (!checkSecurityHeaders(route, res)) return false;

  // Allow redirects (e.g. /admin -> /login)
  if (res.status >= 300 && res.status < 400) {
    console.log(`✓ ${route} -> ${res.status} ${res.headers.get("location") ?? ""}`);
    return true;
  }

  if (res.status >= 500) {
    const body = await res.text().catch(() => "");
    return fail(route, `status ${res.status}`, body.slice(0, 300));
  }
  if (res.status >= 400) {
    return fail(route, `status ${res.status}`);
  }

  const body = await res.text();
  const ct = res.headers.get("content-type") ?? "";

  if (
    ct.includes("application/json") &&
    body.includes('"unhandled":true') &&
    body.includes('"HTTPError"')
  ) {
    return fail(route, "h3 catastrophic SSR error envelope", body.slice(0, 300));
  }
  if (!ct.includes("text/html")) {
    return fail(route, `unexpected content-type ${ct}`);
  }
  if (body.length < MIN_HTML_BYTES) {
    return fail(route, `body too small (${body.length} bytes) — likely blank screen`);
  }
  if (!/<div[^>]*id=["']?root["']?/i.test(body) && !/<body[^>]*>[\s\S]*<\/body>/i.test(body)) {
    return fail(route, "missing app shell markers");
  }

  console.log(`✓ ${route} -> ${res.status} (${body.length} bytes)`);
  return true;
}

console.log(`SSR smoke test against ${BASE}\n`);
const results = await Promise.all(ROUTES.map(check));
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
