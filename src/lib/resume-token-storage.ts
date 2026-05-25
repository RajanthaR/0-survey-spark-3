const RESUME_PREFIX = "eip.resume.";
const LEGACY_PREFIX = "eip.token.";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const RESUME_TOKEN_TTL_MS = THIRTY_DAYS_MS;

type StoredResumeToken = {
  token: string;
  expiresAt: number;
};

function storage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function resumeStorageKey(slug: string): string {
  return `${RESUME_PREFIX}${slug}`;
}

export function setStoredResumeToken(slug: string, token: string, now = Date.now()): void {
  const local = storage();
  if (!local) return;
  const payload: StoredResumeToken = { token, expiresAt: now + RESUME_TOKEN_TTL_MS };
  local.setItem(resumeStorageKey(slug), JSON.stringify(payload));
  local.removeItem(`${LEGACY_PREFIX}${slug}`);
}

export function getStoredResumeToken(slug: string, now = Date.now()): string | undefined {
  const local = storage();
  if (!local) return undefined;

  const key = resumeStorageKey(slug);
  const raw = local.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredResumeToken>;
      if (typeof parsed.token === "string" && typeof parsed.expiresAt === "number") {
        if (parsed.expiresAt <= now) {
          local.removeItem(key);
          return undefined;
        }
        setStoredResumeToken(slug, parsed.token, now);
        return parsed.token;
      }
    } catch {
      local.removeItem(key);
    }
  }

  const legacyToken = local.getItem(`${LEGACY_PREFIX}${slug}`);
  if (legacyToken) {
    setStoredResumeToken(slug, legacyToken, now);
    return legacyToken;
  }

  return undefined;
}

export function clearStoredResumeToken(slug: string): void {
  const local = storage();
  if (!local) return;
  local.removeItem(resumeStorageKey(slug));
  local.removeItem(`${LEGACY_PREFIX}${slug}`);
}

export function buildResumeUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/r/${encodeURIComponent(token)}`;
}

export function persistSearchTokenAndCleanUrl(
  slug: string,
  token: string,
  now = Date.now(),
): string | undefined {
  setStoredResumeToken(slug, token, now);
  if (typeof window === "undefined") return undefined;

  const url = new URL(window.location.href);
  url.searchParams.delete("token");
  const cleanPath = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", cleanPath);
  return cleanPath;
}
