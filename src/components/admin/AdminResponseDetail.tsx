import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { ResponseVisualSummary } from "@/components/survey/ResponseVisualSummary";
import { getResponseAnswers } from "@/lib/admin.stats.functions";
import { getSurvey } from "@/surveys";

/**
 * Lazy-loaded per-response detail. Fetches `answers` JSON only when the
 * admin actually expands a row, then renders the same `<ResponseVisualSummary>`
 * the participant sees on the thank-you screen. Renders in the response's
 * recorded language so the admin verifies what the respondent picked, not
 * a re-translation.
 */
export function AdminResponseDetail({ responseId }: { responseId: string }) {
  const fetchAnswers = useServerFn(getResponseAnswers);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; surveySlug: string; lang: "en" | "si" | "ta"; answers: Record<string, unknown> }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchAnswers({ data: { id: responseId } })
      .then((res) => {
        if (cancelled) return;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(res.answersJson) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        setState({
          kind: "ready",
          surveySlug: res.surveySlug,
          lang: res.language,
          answers: parsed,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load response",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [responseId, fetchAnswers]);

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading response…
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="px-3 py-3 text-xs text-destructive">{state.message}</div>
    );
  }
  const survey = getSurvey(state.surveySlug);
  if (!survey) {
    return (
      <div className="px-3 py-3 text-xs text-muted-foreground">
        Survey definition for "{state.surveySlug}" is unavailable.
      </div>
    );
  }
  return (
    <div className="px-3 py-3">
      <ResponseVisualSummary
        survey={survey}
        answers={state.answers}
        lang={state.lang}
        defaultExpanded={false}
        ariaLabel={`Selections for response ${responseId.slice(0, 8)}`}
      />
    </div>
  );
}