#!/usr/bin/env node
// Node runtime entry for Railway / generic Node hosting.
// Mirrors the request-handling shape that TanStack Start's preview server
// uses (srvx + Web-Fetch handler exported from dist/server/server.js).

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "srvx";
import { serveStatic } from "srvx/static";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, "dist/client");
const serverBundle = resolve(__dirname, "dist/server/server.js");

const handlerModule = await import(pathToFileURL(serverBundle).href);
const handler = handlerModule.default;

if (!handler || typeof handler.fetch !== "function") {
  throw new Error(
    `Invalid server bundle at ${serverBundle}: expected a default export with a .fetch() method.`,
  );
}

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

function healthzResponse() {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

const server = serve({
  port,
  hostname,
  middleware: [serveStatic({ dir: clientDir })],
  fetch: (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return healthzResponse();
    }
    return handler.fetch(request);
  },
});

await server.ready();
console.log(`[survey-spark-3] listening on ${server.url ?? `http://${hostname}:${port}`}`);
