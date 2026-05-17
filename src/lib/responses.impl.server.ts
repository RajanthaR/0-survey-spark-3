import { createAdminClient } from "@/integrations/supabase/client.server";
import { getClientIp, rateLimit } from "@/lib/rate-limit.server";
import { verifyTurnstile } from "@/lib/turnstile.server";

export type StartResponseData = {
  surveySlug: string;
  language: "en" | "si" | "ta";
  consent: Record<string, boolean>;
  userAgent?: string;
  turnstileToken?: string;
  bypassTurnstile?: boolean;
};

export async function startResponseImpl(data: StartResponseData) {
  await rateLimit(getClientIp(), {
    name: "startResponse",
    capacity: 30,
    windowMs: 10 * 60 * 1000,
  });
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
    data.bypassTurnstile === true && process.env.ALLOW_TURNSTILE_BYPASS === "true";
  if (previewBypassUsed) {
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
  const supabaseAdmin = createAdminClient("responses.startResponse");
  const { data: row, error } = await supabaseAdmin
    .from("responses")
    .insert({
      survey_slug: data.surveySlug,
      language: data.language,
      consent: data.consent,
      user_agent: data.userAgent ?? null,
      preview_bypass: previewBypassUsed,
    } as never)
    .select("id, resume_token")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to start");
  return {
    id: row.id,
    resumeToken: row.resume_token,
    previewBypass: previewBypassUsed,
  };
}
