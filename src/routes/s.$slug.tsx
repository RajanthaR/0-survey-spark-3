import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { SurveyRunner } from "@/components/SurveyRunner";
import { getSurvey } from "@/surveys";
import { resumeResponse } from "@/lib/responses.functions";
import { pickText, UI, useLang } from "@/lib/i18n";
import {
  clearStoredResumeToken,
  getStoredResumeToken,
  persistSearchTokenAndCleanUrl,
} from "@/lib/resume-token-storage";

type Search = { token?: string };

export const Route = createFileRoute("/s/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: SurveyPage,
  head: ({ params }) => {
    const survey = getSurvey(params.slug);
    const title = survey ? `${survey.title.en} — EIP Insight` : "Survey — EIP Insight";
    const desc = survey?.subtitle.en ?? "Anonymous research survey.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: `/s/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}` }],
    };
  },
});

function SurveyPage() {
  const { slug } = Route.useParams();
  const { token: searchToken } = Route.useSearch();
  const { lang } = useLang();
  const survey = getSurvey(slug);
  const resumeFn = useServerFn(resumeResponse);

  // Allow same-device resume from localStorage
  const [token, setToken] = useState<string | undefined>(searchToken);
  const [loading, setLoading] = useState(false);
  const [resumed, setResumed] = useState<{
    answers: Record<string, unknown>;
    language: "en" | "si" | "ta";
    consent: Record<string, boolean>;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchToken) {
      persistSearchTokenAndCleanUrl(slug, searchToken);
      setToken(searchToken);
      return;
    }
    if (token) return;
    const local = getStoredResumeToken(slug);
    if (local) setToken(local);
  }, [slug, searchToken, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    resumeFn({ data: { resumeToken: token } })
      .then((row) => {
        if (cancelled || !row) return;
        setResumed({
          answers: row.answers as Record<string, unknown>,
          language: row.language,
          consent: (row.consent as Record<string, boolean>) ?? {},
          status: row.status,
        });
      })
      .catch(() => {
        // invalid token — clear and start fresh
        clearStoredResumeToken(slug);
        setToken(undefined);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, resumeFn, slug]);

  if (!survey) {
    return (
      <main id="main" className="grid min-h-screen place-items-center text-muted-foreground">
        {pickText(UI.surveyNotFound, lang)}
      </main>
    );
  }

  if (loading) {
    return (
      <main id="main" className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <SurveyRunner
      survey={survey}
      initialToken={token}
      initialAnswers={resumed?.answers}
      initialLanguage={resumed?.language}
      initialConsent={resumed?.consent}
      initialStatus={resumed?.status}
    />
  );
}
