import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

type RateLimitConfig = {
  name: string;
  capacity: number;
  windowMs: number;
};

type RateLimitFn = (key: string, cfg: RateLimitConfig) => Promise<void>;
type GetClientIpFn = () => string;

export const CLIENT_ERROR_REPORT_LIMIT: RateLimitConfig = {
  name: "clientErrorReport",
  capacity: 5,
  windowMs: 60_000,
};

export const ErrorReportSchema = z
  .object({
    message: z.string().max(2000),
    stack: z.string().max(8000).optional(),
    url: z.string().max(500).optional(),
    lang: z.enum(["en", "si", "ta"]).optional(),
  })
  .strict();

export type ErrorReportPayload = z.infer<typeof ErrorReportSchema>;

export interface ErrorReportHandlerDeps {
  rateLimit?: RateLimitFn;
  getClientIp?: GetClientIpFn;
  logger?: Pick<Console, "error">;
}

async function resolveRateLimitDeps(deps: ErrorReportHandlerDeps) {
  if (deps.rateLimit && deps.getClientIp) {
    return {
      getClientIp: deps.getClientIp,
      rateLimit: deps.rateLimit,
    };
  }

  const serverDeps = await import("@/lib/rate-limit.server");
  return {
    getClientIp: deps.getClientIp ?? serverDeps.getClientIp,
    rateLimit: deps.rateLimit ?? serverDeps.rateLimit,
  };
}

function badRequest() {
  return new Response("Bad request", {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleErrorReport(
  request: Request,
  deps: ErrorReportHandlerDeps = {},
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest();
  }

  const parsed = ErrorReportSchema.safeParse(body);
  if (!parsed.success) return badRequest();

  const { getClientIp, rateLimit } = await resolveRateLimitDeps(deps);
  try {
    await rateLimit(getClientIp(), CLIENT_ERROR_REPORT_LIMIT);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  (deps.logger ?? console).error("[client-error]", parsed.data);
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/error-report")({
  server: {
    handlers: {
      POST: async ({ request }) => handleErrorReport(request),
    },
  },
});
