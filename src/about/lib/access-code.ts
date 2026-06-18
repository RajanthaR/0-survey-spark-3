/**
 * Soft access gate for the "About this research" explorer.
 *
 * This is a CLIENT-SIDE gate: the code ships in the bundle, so it is a casual
 * speed bump for keeping internal context away from anonymous survey
 * respondents — NOT a security boundary for secrets. Override the default per
 * deployment with the `VITE_ABOUT_ACCESS_CODE` build-time env var (must be
 * exactly four digits, otherwise the default below is used).
 */
const DEFAULT_ABOUT_ACCESS_CODE = "4729";

function resolveCode(): string {
  const raw = import.meta.env.VITE_ABOUT_ACCESS_CODE;
  return typeof raw === "string" && /^\d{4}$/.test(raw) ? raw : DEFAULT_ABOUT_ACCESS_CODE;
}

/** The 4-digit code that unlocks the About explorer. */
export const ABOUT_ACCESS_CODE = resolveCode();

/** Number of digits in the access code. */
export const ABOUT_ACCESS_CODE_LENGTH = 4;

/** sessionStorage key recording that the gate was cleared this session. */
export const ABOUT_ACCESS_STORAGE_KEY = "eip.about.unlocked";

/** Read the per-session unlock flag, SSR/private-mode safe. */
export function readAboutUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ABOUT_ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the per-session unlock flag, SSR/private-mode safe. */
export function persistAboutUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ABOUT_ACCESS_STORAGE_KEY, "1");
  } catch {
    /* sessionStorage unavailable (private mode / SSR) — gate stays per-render */
  }
}
