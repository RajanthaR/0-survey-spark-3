/* eslint-disable */
/**
 * EIP Insight — option image service worker.
 *
 * Cache-first for same-origin image assets. Vite emits content-hashed,
 * immutable filenames for everything bundled (option illustrations live
 * under /assets/), so once an asset lands in the cache it can stay
 * forever — a content change means a new URL. We still bound the cache
 * with a soft entry cap to avoid unbounded growth across versions.
 *
 * Non-image and cross-origin requests fall through to the network
 * untouched. The SW is intentionally narrow: it never intercepts HTML,
 * JS, CSS, API calls, or auth traffic.
 */
const CACHE = "eip-option-images-v1";
const MAX_ENTRIES = 200;
const IMAGE_EXT = /\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?.*)?$/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("eip-option-images-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function shouldHandle(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (request.destination === "image") return true;
  return IMAGE_EXT.test(url.pathname);
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const overflow = keys.length - MAX_ENTRIES;
  for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) {
        // Notify clients so the perf overlay can count a SW cache hit.
        try {
          const clients = await self.clients.matchAll({ type: "window" });
          for (const c of clients) c.postMessage({ type: "eip:img-cache-hit", url: request.url });
        } catch (_) {}
        return cached;
      }
      try {
        const res = await fetch(request);
        // Only cache successful, basic responses (skip opaque).
        if (res && res.status === 200 && res.type === "basic") {
          cache
            .put(request, res.clone())
            .then(() => trim(cache))
            .catch(() => {});
        }
        return res;
      } catch (err) {
        // Network failure with no cache — let the browser surface it.
        throw err;
      }
    })(),
  );
});
