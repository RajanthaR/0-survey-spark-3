/**
 * GET /api/admin/export.csv — streaming all-valid responses CSV.
 *
 * HTTP-level port of the `streamAllValidCsv` server fn so admins (and
 * trusted scripts) can pull the full export over a single download
 * connection instead of the RPC event channel. Reuses
 * `streamAllValidCsvImpl` so the row shape, retry/backoff, and request
 * correlation logic stay identical to the RPC path — there is one
 * generator, two transports.
 *
 * Reliability guarantees mirrored from the RPC variant:
 *   - Per-page retry with exponential backoff + jitter (default 3 attempts,
 *     300ms base, x3 factor) before any chunk is flushed.
 *   - Resume support via `?startPage=N` — the client keeps its partial
 *     buffer from the prior attempt and we skip the BOM + header on
 *     resumed runs so the bytes concatenate cleanly.
 *   - Server-generated `requestId` echoed in `X-Request-Id` and every log
 *     line so failures can be correlated with worker logs.
 *   - Server routes bypass the global `attachSupabaseAuth`/`requireSupabaseAuth`
 *     pair, so the Authorization header is verified inline below; the
 *     same `assertAdmin` check from the RPC path then enforces the role.
 *
 * Note: this endpoint is intended to sit behind production site auth AND
 * still requires its own Bearer token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertAdmin, streamAllValidCsvImpl } from "@/lib/admin.shared.server";
import { createAdminClient } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const QuerySchema = z.object({
  startPage: z.coerce.number().int().min(0).max(399).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
  baseDelayMs: z.coerce.number().int().min(0).max(60_000).optional(),
  backoffFactor: z.coerce.number().min(1).max(10).optional(),
  requestId: z.string().min(8).max(128).optional(),
});

async function authenticate(request: Request): Promise<string> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Response("Server misconfigured: missing Supabase env", {
      status: 500,
    });
  }
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new Response("Unauthorized: Bearer token required", { status: 401 });
  }
  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    throw new Response("Unauthorized: empty token", { status: 401 });
  }
  const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Response("Unauthorized: invalid token", { status: 401 });
  }
  return data.claims.sub;
}

export const Route = createFileRoute("/api/admin/export.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // 1. AuthN — verify Bearer token.
        let userId: string;
        try {
          userId = await authenticate(request);
        } catch (e) {
          if (e instanceof Response) return e;
          throw e;
        }

        // 2. AuthZ — admin role required (same check as RPC path).
        try {
          await assertAdmin(userId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Forbidden";
          return new Response(msg, { status: 403 });
        }

        // 3. Validate query params (resume offset + retry tuning).
        const url = new URL(request.url);
        const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return new Response(`Bad request: ${parsed.error.message}`, {
            status: 400,
          });
        }
        const opts = parsed.data;
        const startPage = opts.startPage ?? 0;
        const supabaseAdmin = createAdminClient("api.admin.exportCsv");

        const requestId =
          opts.requestId ??
          (typeof globalThis.crypto?.randomUUID === "function"
            ? globalThis.crypto.randomUUID()
            : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
        console.info(
          `[export.csv] start requestId=${requestId} startPage=${startPage} ` +
            `maxAttempts=${opts.maxAttempts ?? 3} baseDelayMs=${
              opts.baseDelayMs ?? 300
            } backoffFactor=${opts.backoffFactor ?? 3} userId=${userId}`,
        );

        // 4. Build the generator with the same Supabase deps as the RPC.
        const gen = streamAllValidCsvImpl({
          countCompleted: async () => {
            const { count, error } = await supabaseAdmin
              .from("responses")
              .select("id", { count: "exact", head: true })
              .eq("status", "completed");
            if (error) throw new Error(error.message);
            return count ?? 0;
          },
          fetchPage: async (page, pageSize) => {
            const { data: chunk, error } = await supabaseAdmin
              .from("responses")
              .select(
                "id, survey_slug, language, status, progress_pct, started_at, completed_at, contact, answers",
              )
              .eq("status", "completed")
              .order("started_at", { ascending: false })
              .range(page * pageSize, page * pageSize + pageSize - 1);
            if (error) throw new Error(error.message);
            return (chunk ?? []) as Record<string, unknown>[];
          },
          startPage,
          maxAttempts: opts.maxAttempts,
          baseDelayMs: opts.baseDelayMs,
          backoffFactor: opts.backoffFactor,
          requestId,
        });

        // 5. Pipe events into a ReadableStream<Uint8Array>:
        //    - On a fresh run (startPage=0) emit the UTF-8 BOM so Excel
        //      detects the encoding, then the header line from `meta`,
        //      then every `chunk.csv` verbatim.
        //    - On resume runs we emit nothing for `meta` (the impl skips
        //      the header bytes too, so the streams concatenate cleanly).
        //    - `warn` events are logged server-side; clients tail the
        //      `X-Request-Id` header to correlate with logs.
        //    - On generator failure we append a trailing `# stream failed`
        //      marker and close, so partial files are easy to spot.
        const encoder = new TextEncoder();
        const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
        // Filename matches the impl: it's deterministic from today's date.
        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `eip-insight-all-valid-responses-${stamp}.csv`;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let finalCrc: string | undefined;
            let finalSha: string | undefined;
            let finalRowCount = 0;
            try {
              if (startPage === 0) controller.enqueue(BOM);
              for await (const evt of gen) {
                if (evt.type === "meta") {
                  if (startPage === 0) {
                    controller.enqueue(encoder.encode(evt.headerLine + "\n"));
                  }
                } else if (evt.type === "chunk") {
                  controller.enqueue(encoder.encode(evt.csv));
                } else if (evt.type === "warn") {
                  console.warn(
                    `[export.csv] warn requestId=${evt.requestId} ` +
                      `label="${evt.label}" attempt=${evt.attempt}/${evt.maxAttempts} ` +
                      `message="${evt.message}"`,
                  );
                } else if (evt.type === "checksum") {
                  finalCrc = evt.crc32;
                  finalSha = evt.sha256;
                } else if (evt.type === "done") {
                  finalRowCount = evt.rowCount;
                }
              }
              console.info(
                `[export.csv] done requestId=${requestId} rows=${finalRowCount} ` +
                  `crc32=${finalCrc ?? "-"} sha256=${finalSha ?? "-"}`,
              );
              controller.close();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error(`[export.csv] failed requestId=${requestId}: ${msg}`);
              try {
                controller.enqueue(
                  encoder.encode(`\n# stream failed [requestId=${requestId}]: ${msg}\n`),
                );
              } catch {
                // controller already errored — nothing to do.
              }
              controller.close();
            }
          },
          cancel(reason) {
            console.warn(
              `[export.csv] client cancelled requestId=${requestId} reason=${
                reason instanceof Error ? reason.message : String(reason ?? "")
              }`,
            );
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Request-Id": requestId,
            // Disable proxy buffering so chunks reach the client as
            // soon as they're enqueued (matters for large exports).
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
