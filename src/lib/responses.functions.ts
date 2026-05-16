import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp, rateLimit } from "@/lib/rate-limit.server";
import { verifyTurnstile } from "@/lib/turnstile.server";

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

export const startResponse = createServerFn({ method: "POST" })
  .inputValidator((data) => StartInput.parse(data))
  .handler(async ({ data }) => {
    rateLimit(getClientIp(), { name: "startResponse", capacity: 30, windowMs: 10 * 60 * 1000 });
    // Order matters: rate-limit first (cheap, blocks spam before we spend a
    // siteverify roundtrip), THEN Turnstile (blocks bots before we touch the
    // database), THEN insert. saveAnswers / completeResponse don't re-verify
    // because they're already gated by the rotating resume_token issued
    // here — re-prompting on every autosave would be hostile.
    await verifyTurnstile(data.turnstileToken, {
      bypassRequested: data.bypassTurnstile === true,
    });
    // Track when the preview bypass escape hatch was actually used so
    // admins can filter / audit those rows. Only true when (a) the client
    // requested a bypass AND (b) the deploy opted in via
    // ALLOW_TURNSTILE_BYPASS=true. Without that env, verifyTurnstile
    // throws before this line, so it can never silently flip on in prod.
    const previewBypassUsed =
      data.bypassTurnstile === true &&
      process.env.ALLOW_TURNSTILE_BYPASS === "true";
    if (previewBypassUsed) {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          tag: "preview_bypass_used",
          surveySlug: data.surveySlug,
          language: data.language,
          ip: getClientIp(),
          userAgent: data.userAgent ?? null,
          at: new Date().toISOString(),
        }),
      );
    }
    const { data: row, error } = await supabaseAdmin
      .from("responses")
      .insert({
        survey_slug: data.surveySlug,
        language: data.language,
        consent: data.consent,
        user_agent: data.userAgent ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preview_bypass: previewBypassUsed,
      } as any)
      .select("id, resume_token")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to start");
    return {
      id: row.id,
      resumeToken: row.resume_token,
      previewBypass: previewBypassUsed,
    };
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
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
    rateLimit(getClientIp(), { name: "completeResponse", capacity: 10, windowMs: 10 * 60 * 1000 });
    assertAnswersSize(data.answers);
    await assertNotCompleted(data.resumeToken);
    // Rotate resume_token on completion so any leaked URL is invalidated.
    const rotatedToken = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabaseAdmin
      .from("responses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        answers: data.answers,
        contact: data.contact ?? null,
        progress_pct: 100,
        status: "completed",
        completed_at: new Date().toISOString(),
        resume_token: rotatedToken,
      } as any)
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
