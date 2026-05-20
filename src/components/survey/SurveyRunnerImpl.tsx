import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { pickText, UI, useLang, type Lang } from "@/lib/i18n";
import { startResponse, saveAnswers, completeResponse } from "@/lib/responses.functions";
import type { Survey } from "@/surveys/types";
import {
  isAnswered,
  validateAnswerCode,
  formatValidationError,
  type ValidationError,
} from "@/components/survey/validation";
import { prefetchUpcomingOptionImages } from "@/surveys/visuals/prefetch";
import { SurveyRunnerView } from "@/components/survey/SurveyRunnerView";
import { useAutoSave } from "@/components/survey/hooks/useAutoSave";
import { useFocusReturn } from "@/components/survey/hooks/useFocusReturn";
import { useKeyboardNav } from "@/components/survey/hooks/useKeyboardNav";
import { useResumeToken } from "@/components/survey/hooks/useResumeToken";
import { useStageMachine } from "@/components/survey/hooks/useStageMachine";
import { useSwipeNav } from "@/components/survey/hooks/useSwipeNav";

type Answers = Record<string, unknown>;
type Contact = { name: string; email: string; organization: string };

interface Props {
  survey: Survey;
  initialToken?: string;
  initialAnswers?: Answers;
  initialLanguage?: Lang;
  initialConsent?: Record<string, boolean>;
  initialStatus?: string;
}

export function SurveyRunner({
  survey,
  initialToken,
  initialAnswers,
  initialLanguage,
  initialConsent,
  initialStatus,
}: Props) {
  const { lang, adoptServerLang } = useLang();
  const navigate = useNavigate();
  const startFn = useServerFn(startResponse);
  const saveFn = useServerFn(saveAnswers);
  const completeFn = useServerFn(completeResponse);

  useEffect(() => {
    // Adopt the server-provided language only when the user has not
    // explicitly selected one via the toggle (tracked by `langTouched`
    // inside the i18n provider). This guarantees a resumed response
    // never overwrites the user's persisted choice — including on
    // re-mounts within the same session.
    if (!initialLanguage) return;
    adoptServerLang(initialLanguage);
  }, [adoptServerLang, initialLanguage]);

  const {
    token,
    persist: persistToken,
    clear: clearToken,
  } = useResumeToken(survey.slug, initialToken);
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [consent, setConsent] = useState<Record<string, boolean>>(initialConsent ?? {});
  const [contact, setContact] = useState<Contact>({ name: "", email: "", organization: "" });
  const [busy, setBusy] = useState(false);
  // Inline error surfaced on the consent panel when the server-side
  // Turnstile verification rejects the start request. Held in component
  // state (not a toast) so the message stays visible alongside the retry
  // affordance until the user explicitly retries or navigates back.
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // Direction of the last navigation between questions. Drives the slide
  // direction in <QuestionView> so Forward feels like sliding to the next
  // card and Back feels like sliding to the previous one.
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  // Ref to the sticky-bar Next button so we can return keyboard focus
  // there after every step transition. This makes Enter/Space repeat
  // advance through the questionnaire without keyboard users having to
  // re-Tab to the primary CTA on every step.
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  // Store the *code* (not the localized string) so the displayed message
  // re-renders in the user's current language whenever the toggle changes.
  const [validationErrorCode, setValidationErrorCode] = useState<
    ValidationError | "required" | null
  >(null);
  const {
    stage,
    setStage,
    visible,
    pct,
    setCurrentId,
    idx,
    current,
    jumpToEdit: jumpToEditBase,
  } = useStageMachine({ survey, answers, initialToken, initialStatus });
  const validationError = useMemo(() => {
    if (!validationErrorCode) return null;
    if (validationErrorCode === "required") return pickText(UI.required, lang);
    return formatValidationError(validationErrorCode, lang);
  }, [validationErrorCode, lang]);

  // Track previous position so a skip (idx jump > 1 forward) can briefly
  // surface a "+N skipped" pill on the progress header. This makes it
  // obvious to respondents that the indicator jumped because already-
  // answered questions in between were skipped, not because state was
  // lost. The pill auto-fades after ~1.6s.
  const prevIdxRef = useRef<number>(idx);
  const [skippedCount, setSkippedCount] = useState(0);
  useEffect(() => {
    const prev = prevIdxRef.current;
    prevIdxRef.current = idx;
    if (idx - prev > 1) {
      setSkippedCount(idx - prev - 1);
      const id = window.setTimeout(() => setSkippedCount(0), 1600);
      return () => window.clearTimeout(id);
    }
  }, [idx]);

  // Warm the HTTP cache for the next few questions' option images while
  // the user reads the current one. Horizon is configurable (default 3)
  // so longer surveys can pre-roll further without flooding the network.
  // Static, hashed assets then come from the disk / SW cache on the next
  // render — no network blocking on low-end mobile.
  useEffect(() => {
    if (stage !== "questions") return;
    prefetchUpcomingOptionImages(visible, idx);
  }, [stage, idx, visible]);

  const autoSavePayload = useMemo(
    () => ({ answers, progressPct: pct, language: lang }),
    [answers, lang, pct],
  );
  const saveAuto = useCallback(
    async (payload: typeof autoSavePayload) => {
      if (!token) return;
      await saveFn({
        data: {
          resumeToken: token,
          answers: payload.answers,
          progressPct: payload.progressPct,
          language: payload.language,
        },
      });
    },
    [saveFn, token],
  );
  const autoSave = useAutoSave({
    enabled: !!token && stage === "questions",
    payload: autoSavePayload,
    save: saveAuto,
  });

  const beginIfNeeded = useCallback(
    async (opts?: { bypassTurnstile?: boolean }) => {
      if (token) return token;
      setBusy(true);
      try {
        const res = await startFn({
          data: {
            surveySlug: survey.slug,
            language: lang,
            consent,
            userAgent:
              typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined,
            bypassTurnstile: opts?.bypassTurnstile === true ? true : undefined,
          },
        });
        persistToken(res.resumeToken);
        setVerifyError(null);
        navigate({ to: "/s/$slug", params: { slug: survey.slug }, replace: true });
        return res.resumeToken;
      } finally {
        setBusy(false);
      }
    },
    [consent, lang, navigate, persistToken, startFn, survey.slug, token],
  );

  const manualSave = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      await saveFn({
        data: { resumeToken: token, answers, progressPct: pct, language: lang },
      });
      autoSave.markSaved();
      toast.success(pickText(UI.saved, lang));
    } catch {
      toast.error(pickText(UI.errorSave, lang));
    } finally {
      setBusy(false);
    }
  }, [answers, autoSave, lang, pct, saveFn, token]);

  const submitAll = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      await completeFn({ data: { resumeToken: token, answers, contact } });
      setStage("done");
      clearToken();
    } catch {
      toast.error(pickText(UI.errorSave, lang));
    } finally {
      setBusy(false);
    }
  }, [answers, clearToken, completeFn, contact, lang, setStage, token]);

  const setAnswer = useCallback(
    (id: string, value: unknown) => {
      setAnswers((a) => ({ ...a, [id]: value }));
      if (validationErrorCode) setValidationErrorCode(null);
    },
    [validationErrorCode],
  );

  const goNext = useCallback(() => {
    if (!current) return;
    if (current.required && !isAnswered(current, answers)) {
      setValidationErrorCode("required");
      toast.error(pickText(UI.required, lang));
      return;
    }
    const err = validateAnswerCode(current, answers[current.id]);
    if (err) {
      setValidationErrorCode(err);
      toast.error(formatValidationError(err, lang));
      return;
    }
    setValidationErrorCode(null);
    if (idx < visible.length - 1) {
      const after = visible.slice(idx + 1);
      const nextUnanswered = after.find((q) => !isAnswered(q, answers));
      const nextId = (nextUnanswered ?? visible[idx + 1]).id;
      setNavDirection(1);
      setCurrentId(nextId);
      const enc = UI.encouragements;
      if (enc && idx === Math.floor(visible.length / 2) - 1) {
        toast(pickText(enc[1], lang));
      }
    } else {
      setStage("review");
    }
  }, [answers, current, idx, lang, setCurrentId, setStage, visible]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  const continueOptional = useCallback(
    async (opts?: { bypassTurnstile?: boolean }) => {
      try {
        await beginIfNeeded(opts);
        setStage("questions");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/verif(?:y|ication)|challenge/i.test(message)) setVerifyError(message);
        else toast.error(pickText(UI.errorSave, lang));
      }
    },
    [beginIfNeeded, lang, setStage],
  );

  const jumpToEdit = useCallback(
    (id: string) => {
      setNavDirection(1);
      jumpToEditBase(id);
      setValidationErrorCode(null);
    },
    [jumpToEditBase],
  );

  const goBack = useCallback(() => {
    if (idx <= 0) return;
    setNavDirection(-1);
    setCurrentId(visible[idx - 1].id);
    setValidationErrorCode(null);
  }, [idx, setCurrentId, visible]);

  const runLatestGoNext = useCallback(() => goNextRef.current(), []);

  const goFirst = useCallback(() => {
    if (visible[0]) setCurrentId(visible[0].id);
    setValidationErrorCode(null);
  }, [setCurrentId, visible]);

  const goLast = useCallback(() => {
    if (visible.length) setCurrentId(visible[visible.length - 1].id);
    setValidationErrorCode(null);
  }, [setCurrentId, visible]);

  const swipeHandlers = useSwipeNav({ onNext: runLatestGoNext, onBack: goBack });
  useKeyboardNav({
    enabled: stage === "questions",
    onFirst: goFirst,
    onLast: goLast,
    onNext: runLatestGoNext,
    onBack: goBack,
  });
  useFocusReturn({
    enabled: stage === "questions",
    focusKey: current?.id,
    direction: navDirection,
    nextButtonRef,
    backButtonRef,
  });

  return (
    <SurveyRunnerView
      survey={survey}
      lang={lang}
      stage={stage}
      visible={visible}
      current={current}
      idx={idx}
      pct={pct}
      skippedCount={skippedCount}
      answers={answers}
      consent={consent}
      contact={contact}
      busy={busy}
      token={token}
      verifyError={verifyError}
      navDirection={navDirection}
      validationError={validationError}
      nextButtonRef={nextButtonRef}
      backButtonRef={backButtonRef}
      swipeHandlers={swipeHandlers}
      onStart={() => setStage("consent")}
      onRequiredConsentAccepted={(ids) => {
        setConsent((s) => {
          const next = { ...s };
          for (const id of ids) next[id] = true;
          return next;
        });
        setStage("consent-optional");
      }}
      onOptionalConsentToggle={(id, value) => setConsent((s) => ({ ...s, [id]: value }))}
      onOptionalBack={() => setStage("consent")}
      onOptionalContinue={continueOptional}
      onRetryVerify={() => {
        setVerifyError(null);
        return continueOptional();
      }}
      onBypassVerify={() => {
        setVerifyError(null);
        return continueOptional({ bypassTurnstile: true });
      }}
      onEdit={jumpToEdit}
      onQuestionChange={(value) => {
        if (current) setAnswer(current.id, value);
      }}
      onAutoAdvance={runLatestGoNext}
      onReviewContinue={() => setStage("contact")}
      onContactChange={(field, value) => setContact((c) => ({ ...c, [field]: value }))}
      onContactBack={() => setStage("review")}
      onSubmit={submitAll}
      onQuestionBack={goBack}
      onManualSave={manualSave}
      onQuestionNext={goNext}
    />
  );
}
