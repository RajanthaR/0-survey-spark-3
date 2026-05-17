/**
 * Registers the option-image service worker (public/sw.js).
 *
 * Safe to call multiple times; the browser dedupes registrations by scope.
 * Skips on SSR, on non-secure contexts (except localhost), and when the
 * UA has no `serviceWorker` (older Safari, in-app browsers).
 */
export function registerOptionImageSW(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Avoid registering in test/dev iframes where the SW would persist
  // across HMR reloads and surprise developers debugging cache state.
  if (import.meta.env?.DEV) return;
  // Defer until after first paint so registration never competes with
  // the LCP critical path.
  const start = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Non-fatal — caching is a perf optimisation, not a correctness
      // requirement. Swallow so we don't log noise in prod consoles.
    });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
