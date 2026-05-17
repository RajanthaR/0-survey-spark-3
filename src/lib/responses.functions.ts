import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Hard cap to prevent abusive payloads. ~64 KB is plenty for any realistic
// survey response (text fields are short; long_text is the only large field).
const MAX_ANSWERS_BYTES = 64 * 1024;

function assertAnswersSize(answers: unknown) {
  const size = new TextEncoder().encode(JSON.stringify(answers ?? {})).length;
  if (size > MAX_ANSWERS_BYTES) {
    throw new Error(`Payload too large (${size} bytes, max ${MAX_ANSWERS_BYTES})`);
  }
}

async function assertNotCompleted(resumeToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("responses")
    .select("status")
    .eq("resume_token", resumeToken)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Response not found");
  if (data.status === "completed") {
    throw new Error("This response is already submitted and can't be edited.");
  }
}

const StartInput = z.object({
  surveySlug: z.string().min(1).max(64),
  language: z.enum(["en", "si", "ta"]).default("en"),
  consent: z.record(z.string().max(64), z.boolean()).default({}),
  userAgent: z.string().max(500).optional(),
  // Cloudflare Turnstile challenge token captured by the consent screen.
  // Optional in the schema so dev/preview without `TURNSTILE_SECRET` keeps
  // working — `verifyTurnstile` enforces presence at runtime when the
  // secret is configured.
  turnstileToken: z.string().min(1).max(2048).optional(),
  // Preview/dev-only escape hatch. The server only honours this when
  // `ALLOW_TURNSTILE_BYPASS=true` is set on the deploy — production ignores
  // it entirely, so flipping this from the client cannot weaken security.
  bypassTurnstile: z.boolean().optional(),
});

type StartData = z.infer<typeof StartInput>;

export const startResponse = createServerFn({ method: "POST" })
  .inputValidator((data) => StartInput.parse(data))
  .handler(async ({ data }) => {
    const { startResponseImpl } = await import("@/lib/responses.impl.server");
    return startResponseImpl(data);
  });

const SaveInput = z.object({
  resumeToken: z.string().min(8).max(128),
  answers: z.record(z.string().max(128), z.unknown()),
  progressPct: z.number().int().min(0).max(100),
  language: z.enum(["en", "si", "ta"]).optional(),
});

export const saveAnswers = createServerFn({ method: "POST" })
  .inputValidator((data) => SaveInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getClientIp, rateLimit } = await import("@/lib/rate-limit.server");
    rateLimit(getClientIp(), { name: "saveAnswers", capacity: 120, windowMs: 60 * 1000 });
    assertAnswersSize(data.answers);
    await assertNotCompleted(data.resumeToken);
    const update: Record<string, unknown> = {
      answers: data.answers,
      progress_pct: data.progressPct,
    };
    if (data.language) update.language = data.language;
    const { error } = await supabaseAdmin
      .from("responses")
      .update(update as never)
      .eq("resume_token", data.resumeToken);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CompleteInput = z.object({
  resumeToken: z.string().min(8).max(128),
  answers: z.record(z.string().max(128), z.unknown()),
  contact: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().email().max(200).optional().or(z.literal("")),
      organization: z.string().max(200).optional(),
    })
    .optional(),
});

export const completeResponse = createServerFn({ method: "POST" })
  .inputValidator((data) => CompleteInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getClientIp, rateLimit } = await import("@/lib/rate-limit.server");
    rateLimit(getClientIp(), { name: "completeResponse", capacity: 10, windowMs: 10 * 60 * 1000 });
    assertAnswersSize(data.answers);
    await assertNotCompleted(data.resumeToken);
    // Rotate resume_token on completion so any leaked URL is invalidated.
    const rotatedToken = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabaseAdmin
      .from("responses")
      .update({
        answers: data.answers,
        contact: data.contact ?? null,
        progress_pct: 100,
        status: "completed",
        completed_at: new Date().toISOString(),
        resume_token: rotatedToken,
      } as never)
      .eq("resume_token", data.resumeToken);
    if (error) throw new Error(error.message);
    return { ok: true, rotatedToken };
  });

const ResumeInput = z.object({
  resumeToken: z.string().min(8).max(128),
});

export const resumeResponse = createServerFn({ method: "POST" })
  .inputValidator((data) => ResumeInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getClientIp, rateLimit } = await import("@/lib/rate-limit.server");
    rateLimit(getClientIp(), { name: "resumeResponse", capacity: 60, windowMs: 10 * 60 * 1000 });
    const { data: row, error } = await supabaseAdmin
      .from("responses")
      .select("id, survey_slug, language, status, answers, progress_pct, consent")
      .eq("resume_token", data.resumeToken)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      id: row.id,
      surveySlug: row.survey_slug,
      language: row.language as "en" | "si" | "ta",
      status: row.status,
      answers: (row.answers ?? {}) as Record<string, unknown> as never,
      progressPct: row.progress_pct,
      consent: row.consent,
    };
  });
