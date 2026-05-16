/**
 * Configurable "View logs" link.
 *
 * Admins paste a URL template containing the literal `{requestId}` (or the
 * shorthand `{id}`) placeholder. We substitute the run's requestId and open
 * the resulting URL — letting each deployment point at whatever logging
 * system it actually uses (Cloudflare worker logs, Datadog, Logtail, a
 * Supabase analytics dashboard, etc.) without hard-coding it in the app.
 *
 * The template is persisted in localStorage so it survives refreshes and is
 * scoped per browser/admin. Empty template = feature off (no link rendered).
 */

const STORAGE_KEY = "eip-insight:admin:logUrlTemplate:v1";
const PLACEHOLDER_RE = /\{(?:requestId|id)\}/g;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getLogUrlTemplate(): string {
  return safeStorage()?.getItem(STORAGE_KEY) ?? "";
}

export function setLogUrlTemplate(template: string): void {
  const s = safeStorage();
  if (!s) return;
  const trimmed = template.trim();
  if (!trimmed) s.removeItem(STORAGE_KEY);
  else s.setItem(STORAGE_KEY, trimmed);
}

/**
 * Build a log URL for the given requestId, or null if the template is
 * unset, the requestId is missing/unknown, or the resulting URL doesn't
 * parse (we never open arbitrary `javascript:` strings).
 */
export function buildLogUrl(
  requestId: string | null | undefined,
  template?: string,
): string | null {
  const t = (template ?? getLogUrlTemplate()).trim();
  if (!t) return null;
  if (!requestId || requestId === "unknown") return null;
  if (!PLACEHOLDER_RE.test(t)) return null;
  // Reset lastIndex — the regex has the global flag.
  PLACEHOLDER_RE.lastIndex = 0;
  const url = t.replace(PLACEHOLDER_RE, encodeURIComponent(requestId));
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function openLogUrl(requestId: string | null | undefined): void {
  const url = buildLogUrl(requestId);
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}
