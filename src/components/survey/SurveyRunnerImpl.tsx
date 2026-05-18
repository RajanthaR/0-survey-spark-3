import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FocusTrap } from "@/components/FocusTrap";
import { pickText, t, useLang, UI } from "@/lib/i18n";
import { startResponse, saveAnswers, completeResponse } from "@/lib/responses.functions";
import type { Survey } from "@/surveys/types";
import { progressFor, visibleQuestions } from "@/lib/survey-logic";
import { QuestionCount, QuestionPosition } from "@/components/QuestionCount";
import {
  EMAIL_RE,
  isAnswered,
  validateAnswer,
  validateAnswerCode,
  formatValidationError,
  type ValidationError,
} from "@/components/survey/validation";
import { ResumeStrip } from "@/components/survey/ResumeStrip";
import { ReviewPanel } from "@/components/survey/ReviewPanel";
import { QuestionView } from "@/components/survey/QuestionView";
import { OptionalConsentPanel } from "@/components/survey/OptionalConsentPanel";
import { ResponseVisualSummary } from "@/components/survey/ResponseVisualSummary";
import { QuestionMap } from "@/components/survey/QuestionMap";
import { prefetchUpcomingOptionImages } from "@/surveys/visuals/prefetch";
import { clearStoredResumeToken, setStoredResumeToken } from "@/lib/resume-token-storage";

type Answers = Record<string, unknown>;
type Stage = "intro" | "consent" | "consent-optional" | "questions" | "review" | "contact" | "done";

interface Props {
  survey: Survey;
  initialToken?: string;
  initialAnswers?: Answers;
  initialLanguage?: "en" | "si" | "ta";
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

  const [token, setToken] = useState<string | undefined>(initialToken);
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [consent, setConsent] = useState<Record<string, boolean>>(initialConsent ?? {});
  const [stage, setStage] = useState<Stage>(
    initialStatus === "completed" ? "done" : initialToken ? "questions" : "intro",
  );
  const [contact, setContact] = useState({ name: "", email: "", organization: "" });
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
  const [focusableBlockedQuestionId, setFocusableBlockedQuestionId] = useState<string | null>(null);
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
  const validationError = useMemo(() => {
    if (!validationErrorCode) return null;
    if (validationErrorCode === "required") return pickText(UI.required, lang);
    return formatValidationError(validationErrorCode, lang);
  }, [validationErrorCode, lang]);

  const visible = useMemo(() => visibleQuestions(survey, answers), [survey, answers]);
  const pct = useMemo(() => progressFor(survey, answers), [survey, answers]);

  // ── id-based current question (survives visibility shifts) ──
  const [currentId, setCurrentId] = useState<string | undefined>(() => visible[0]?.id);
  useEffect(() => {
    if (!visible.length) return;
    if (!currentId || !visible.some((q) => q.id === currentId)) {
      setCurrentId(visible[0].id);
    }
  }, [visible, currentId]);
  const idx = currentId ? visible.findIndex((q) => q.id === currentId) : 0;
  const current = idx >= 0 ? visible[idx] : visible[0];

  // Track previous position so a skip (idx jump > 1 forward) can briefly
  // surface a "+N skipped" pill on the progress header. This makes it
  // obvious to respondents that the indicator jumped because already-
  // answered questions in between were skipped, not because state was
  // lost. The pill auto-fades after ~1.6s.
  const prevIdxRef = useRef<number>(idx);
  const [skippedCount, setSkippedCount] = useState(0);
  const prefersReducedMotion = useReducedMotion();
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

  // Persist token locally so a refresh on the same device resumes.
  useEffect(() => {
    if (token && typeof window !== "undefined") {
      setStoredResumeToken(survey.slug, token);
    }
  }, [token, survey.slug]);

  // ── debounced fire-and-forget save (no UI blocking) ──
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const lastSavedRef = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || stage !== "questions") return;
    const payload = JSON.stringify({ answers, pct, lang });
    if (payload === lastSavedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSavedRef.current = payload;
      saveFnRef
        .current({
          data: { resumeToken: token, answers, progressPct: pct, language: lang },
        })
        .catch(() => {
          // fire-and-forget: a failure here is non-fatal; user can also tap save
          lastSavedRef.current = "";
        });
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [token, stage, answers, pct, lang]);

  // ── flush on tab hide via sendBeacon ──
  useEffect(() => {
    if (!token) return;
    const flush = () => {
      const payload = JSON.stringify({ answers, pct, lang });
      if (payload === lastSavedRef.current) return;
      lastSavedRef.current = payload;
      // Best-effort; ignore if browser refuses.
      saveFnRef
        .current({
          data: { resumeToken: token, answers, progressPct: pct, language: lang },
        })
        .catch(() => {});
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [token, answers, pct, lang]);

  async function beginIfNeeded(opts?: { bypassTurnstile?: boolean }) {
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
      setToken(res.resumeToken);
      setVerifyError(null);
      setStoredResumeToken(survey.slug, res.resumeToken);
      navigate({ to: "/s/$slug", params: { slug: survey.slug }, replace: true });
      return res.resumeToken;
    } finally {
      setBusy(false);
    }
  }

  async function manualSave() {
    if (!token) return;
    setBusy(true);
    try {
      await saveFn({
        data: { resumeToken: token, answers, progressPct: pct, language: lang },
      });
      lastSavedRef.current = JSON.stringify({ answers, pct, lang });
      toast.success(pickText(UI.saved, lang));
    } catch {
      toast.error(pickText(UI.errorSave, lang));
    } finally {
      setBusy(false);
    }
  }

  async function submitAll() {
    if (!token) return;
    setBusy(true);
    try {
      await completeFn({ data: { resumeToken: token, answers, contact } });
      setStage("done");
      clearStoredResumeToken(survey.slug);
    } catch {
      toast.error(pickText(UI.errorSave, lang));
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(id: string, value: unknown) {
    setAnswers((a) => ({ ...a, [id]: value }));
    if (validationErrorCode) setValidationErrorCode(null);
  }

  function goNext() {
    if (!current) return;
    // required-empty
    if (current.required && !isAnswered(current, answers)) {
      setValidationErrorCode("required");
      toast.error(pickText(UI.required, lang));
      return;
    }
    // type-format
    const err = validateAnswerCode(current, answers[current.id]);
    if (err) {
      setValidationErrorCode(err);
      toast.error(formatValidationError(err, lang));
      return;
    }
    setValidationErrorCode(null);
    if (idx < visible.length - 1) {
      // Prefer the next *unanswered* visible question after the current
      // one — this keeps thumb-driven respondents moving through what's
      // left to do, and only falls back to strict sequential advance when
      // every later question already has an answer (e.g. returning from
      // the review screen to fix something specific).
      const after = visible.slice(idx + 1);
      const nextUnanswered = after.find((q) => !isAnswered(q, answers));
      const nextId = (nextUnanswered ?? visible[idx + 1]).id;
      setNavDirection(1);
      setFocusableBlockedQuestionId(nextId);
      setCurrentId(nextId);
      const enc = UI.encouragements;
      if (enc && idx === Math.floor(visible.length / 2) - 1) {
        toast(pickText(enc[1], lang));
      }
    } else {
      setStage("review");
    }
  }

  // Ref to the latest goNext so timer callbacks (e.g. auto-advance after a
  // single-choice selection) always see fresh `answers` / `idx` state.
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  const jumpToEdit = useCallback((id: string) => {
    setNavDirection(1);
    setCurrentId(id);
    setStage("questions");
    setValidationErrorCode(null);
  }, []);

  // Back navigation extracted so swipe gestures and the bottom Back button
  // share one implementation (slide-from-left + idx-1, no skipping).
  const goBack = useCallback(() => {
    if (idx <= 0) return;
    setNavDirection(-1);
    setFocusableBlockedQuestionId(null);
    setCurrentId(visible[idx - 1].id);
    setValidationErrorCode(null);
  }, [idx, visible]);

  // ── swipe gestures: ← next (with next-unanswered skip), → back ──
  // Implemented with pointer events so the same handler works for touch,
  // pen, and trackpad horizontal drags. We track only the first active
  // pointer to avoid pinch-zoom and multi-touch interference. Vertical
  // intent (|dy| > |dx|) is left to the browser so page scroll still
  // works. The threshold (~48px, roughly a thumb-width) matches iOS-style
  // edge-swipe and keeps small jitter from triggering navigation.
  const swipe = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);
  const SWIPE_THRESHOLD = 48;
  const onSwipePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return; // mouse uses the buttons
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        target.isContentEditable ||
        target.closest("[data-no-swipe]")
      ) {
        return;
      }
    }
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: true };
  }, []);
  const onSwipePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = swipe.current;
      if (!s || s.id !== e.pointerId || !s.active) return;
      swipe.current = null;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) return; // mostly vertical → ignore
      if (dx < 0) {
        goNextRef.current();
      } else {
        goBack();
      }
    },
    [goBack],
  );
  const onSwipePointerCancel = useCallback(() => {
    swipe.current = null;
  }, []);

  // ── keyboard shortcuts: Home → first question, End → last question ──
  // Active only on the questions stage; ignored when the user is typing in
  // an input / textarea / contentEditable so it never fights text editing.
  useEffect(() => {
    if (stage !== "questions") return;
    const handler = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable)
          return;
      }
      if (e.key === "Home") {
        if (visible.length === 0) return;
        e.preventDefault();
        setCurrentId(visible[0].id);
        setValidationErrorCode(null);
      } else if (e.key === "End") {
        if (visible.length === 0) return;
        e.preventDefault();
        setCurrentId(visible[visible.length - 1].id);
        setValidationErrorCode(null);
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        // Forward navigation via keyboard. Enter / Space already work
        // natively when the Next button has focus, so we don't intercept
        // those here — that would double-fire on the button's own click
        // handler. Arrow / PageDown keys are the keyboard-only path.
        e.preventDefault();
        goNextRef.current();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, visible, goBack]);

  // Return focus to the sticky action bar after every question
  // transition so a keyboard user can keep advancing with Enter / Space
  // (or Arrow keys) without re-Tabbing to the primary CTA. Defer until
  // after the new question's initial-focus pass, then restore the sticky
  // action focus. When going backward, prefer the Back button so repeated
  // activation feels symmetric.
  const activeQuestionId = current?.id;
  useEffect(() => {
    if (stage !== "questions") return;
    if (!activeQuestionId) return;
    const id = window.setTimeout(() => {
      const target =
        navDirection === -1 && backButtonRef.current && !backButtonRef.current.disabled
          ? backButtonRef.current
          : nextButtonRef.current && !nextButtonRef.current.disabled
            ? nextButtonRef.current
            : backButtonRef.current;
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [stage, activeQuestionId, navDirection]);

  // ───────────────────────── render ─────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
              {pickText(UI.appName, lang)}
            </p>
            <h1 className="truncate text-base font-semibold">{pickText(survey.title, lang)}</h1>
          </div>
          <div className="flex items-center gap-2">
            {stage === "questions" && (
              <QuestionMap
                survey={survey}
                answers={answers}
                lang={lang}
                currentId={current?.id}
                onJump={jumpToEdit}
              />
            )}
            <LanguageToggle compact />
          </div>
        </div>
        {stage === "questions" && (
          <div className="mx-auto max-w-2xl px-4 pb-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
                {/* The whole position swaps on idx change so the localized
                    "Question N of M" gets a smooth fade-up — visually
                    advancing in step with the slide animation on the
                    question card. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <QuestionPosition
                    current={idx + 1}
                    total={visible.length}
                    announce
                    className="inline-flex font-medium tabular-nums text-foreground"
                  />
                  {skippedCount > 0 && (
                    <motion.span
                      key={`skip-${idx}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      role="status"
                      aria-live="polite"
                      data-testid="skipped-pill"
                      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      +{skippedCount} {pickText(UI.skipped, lang)}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span aria-hidden="true" className="sr-only tabular-nums">
                  {pct}%
                </span>
              </div>
              <motion.span
                key={`pct-${pct}`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                aria-hidden="true"
                className="tabular-nums"
              >
                {pct}%
              </motion.span>
            </div>
            <Progress
              value={pct}
              className="mt-1.5 h-2"
              // Smoother, slightly longer fill so the bar visibly catches
              // up with the position counter on every advance (and clearly
              // sweeps forward when a skip jumps the indicator by >1).
              style={{
                ["--progress-transition" as string]: "600ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              aria-label={pickText(UI.progress, lang)}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}
      </header>

      <FocusTrap
        active={stage === "consent" || stage === "consent-optional" || stage === "questions"}
        focusKey={`${stage}:${current?.id ?? ""}`}
      >
        <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
          <AnimatePresence mode="wait">
            {stage === "intro" && (
              <motion.section
                key="intro"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                <div className="rounded-3xl gradient-eco p-6 text-primary-foreground shadow-soft">
                  <p className="text-sm opacity-90">{pickText(UI.tagline, lang)}</p>
                  <h2 className="mt-2 text-2xl font-semibold">{pickText(survey.title, lang)}</h2>
                  <p className="mt-2 text-sm opacity-90">{pickText(survey.subtitle, lang)}</p>
                  <p className="mt-4 text-xs opacity-80">
                    ~{survey.estimatedMinutes} min ·{" "}
                    <QuestionCount count={survey.questions.length} />
                  </p>
                </div>
                <Button
                  size="lg"
                  className="h-14 w-full rounded-2xl text-base"
                  onClick={() => setStage("consent")}
                >
                  {pickText(UI.start, lang)} <ArrowRight className="ml-2 size-5" />
                </Button>
              </motion.section>
            )}

            {stage === "consent" &&
              (() => {
                const required = survey.consent.filter((c) => c.required);
                // c13 first, then the rest in their existing order
                const ordered = [
                  ...required.filter((c) => c.id === "c13"),
                  ...required.filter((c) => c.id !== "c13"),
                ];
                return (
                  <motion.section
                    key="consent"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-4"
                  >
                    <h2 className="text-xl font-semibold">
                      {pickText(UI.requirementsTitle, lang)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {pickText(UI.requirementsLead, lang)}
                    </p>
                    <Accordion type="single" collapsible className="rounded-2xl border bg-card">
                      {ordered.map((c) => (
                        <AccordionItem key={c.id} value={c.id} className="px-4">
                          <AccordionTrigger className="text-left text-sm font-medium">
                            {pickText(c.shortLabel ?? c.label, lang)}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                            {pickText(c.label, lang)}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    <Button
                      size="lg"
                      className="h-14 w-full rounded-2xl"
                      disabled={busy}
                      onClick={() => {
                        setConsent((s) => {
                          const next = { ...s };
                          for (const c of required) next[c.id] = true;
                          return next;
                        });
                        setStage("consent-optional");
                      }}
                    >
                      {busy ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        pickText(UI.consentAgree, lang)
                      )}
                    </Button>
                  </motion.section>
                );
              })()}

            {stage === "consent-optional" &&
              (() => {
                const optional = survey.consent.filter((c) => !c.required);
                const continueOptional = async (opts?: { bypassTurnstile?: boolean }) => {
                  try {
                    await beginIfNeeded(opts);
                    setStage("questions");
                  } catch (err) {
                    // Server-side Turnstile rejection surfaces here as a thrown
                    // Error from the serverFn RPC. Detect it heuristically by
                    // the message body produced by TurnstileVerificationError
                    // ("Verification failed (...)", "human-verification
                    // challenge", "verification service") and keep the user on
                    // the consent panel with an inline retry. Other failures
                    // fall back to the existing save-error toast so the user
                    // still sees something.
                    const message = err instanceof Error ? err.message : String(err);
                    const isVerify = /verif(?:y|ication)|challenge/i.test(message);
                    if (isVerify) {
                      setVerifyError(message);
                    } else {
                      toast.error(pickText(UI.errorSave, lang));
                    }
                  }
                };
                // Show "Continue anyway" only in dev or local preview hosts.
                // The server still gates on ALLOW_TURNSTILE_BYPASS, so flipping
                // this client flag in production has no effect.
                const allowBypass =
                  import.meta.env.DEV ||
                  (typeof window !== "undefined" &&
                    /localhost|127\.0\.0\.1/.test(window.location.hostname));
                return (
                  <OptionalConsentPanel
                    items={optional}
                    lang={lang}
                    values={consent}
                    busy={busy}
                    onToggle={(id, v) => setConsent((s) => ({ ...s, [id]: v }))}
                    onBack={() => setStage("consent")}
                    onContinue={continueOptional}
                    verifyError={verifyError}
                    onRetryVerify={() => {
                      setVerifyError(null);
                      return continueOptional();
                    }}
                    allowBypass={allowBypass}
                    onBypass={() => {
                      setVerifyError(null);
                      return continueOptional({ bypassTurnstile: true });
                    }}
                  />
                );
              })()}

            {stage === "questions" && current && (
              <div
                key={current.id}
                data-testid="question-swipe-surface"
                className="touch-pan-y"
                onPointerDown={onSwipePointerDown}
                onPointerUp={onSwipePointerUp}
                onPointerCancel={onSwipePointerCancel}
              >
                <QuestionView
                  q={current}
                  value={answers[current.id]}
                  direction={navDirection}
                  onChange={(v) => {
                    setAnswer(current.id, v);
                    // Auto-advance on single-select question types so respondents
                    // don't have to tap Next after picking the only allowed answer.
                    if (current.type === "single_choice" || current.type === "yes_no") {
                      setTimeout(() => goNextRef.current(), 220);
                    }
                  }}
                  error={validationError}
                />
              </div>
            )}

            {stage === "review" && (
              <ReviewPanel
                survey={survey}
                answers={answers}
                lang={lang}
                onEdit={jumpToEdit}
                onContinue={() => setStage("contact")}
              />
            )}

            {stage === "contact" && (
              <motion.section
                key="contact"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold">{pickText(UI.thanksTitle, lang)}</h2>
                <p className="text-sm text-muted-foreground">{pickText(UI.thanksLead, lang)}</p>
                <div className="space-y-3">
                  <div>
                    <Label>{pickText(UI.nameLabel, lang)}</Label>
                    <Input
                      className="mt-1 h-12"
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{pickText(UI.emailLabel, lang)}</Label>
                    <Input
                      type="email"
                      className="mt-1 h-12"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{pickText(UI.orgLabel, lang)}</Label>
                    <Input
                      className="mt-1 h-12"
                      value={contact.organization}
                      onChange={(e) => setContact((c) => ({ ...c, organization: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 rounded-2xl"
                    onClick={() => setStage("review")}
                    disabled={busy}
                  >
                    <ArrowLeft className="size-5" />
                  </Button>
                  <Button
                    size="lg"
                    className="h-14 flex-1 rounded-2xl"
                    onClick={submitAll}
                    disabled={busy || (contact.email !== "" && !EMAIL_RE.test(contact.email))}
                  >
                    {busy ? <Loader2 className="size-5 animate-spin" /> : pickText(UI.submit, lang)}
                  </Button>
                </div>
              </motion.section>
            )}

            {stage === "done" && (
              <motion.section
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="mx-auto grid size-20 place-items-center rounded-full gradient-eco text-primary-foreground shadow-soft"
                >
                  <Check className="size-10" />
                </motion.div>
                <h2 className="text-2xl font-semibold">{pickText(UI.thanksTitle, lang)}</h2>
                <p className="text-sm text-muted-foreground">{pickText(UI.thanksLead, lang)}</p>
                <ResponseVisualSummary survey={survey} answers={answers} />
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        {/* Sticky bottom action bar */}
        {stage === "questions" && current && (
          <nav
            // Thumb-zone CTA bar. The elevated shadow lifts it visually off
            // the question card so the eye finds it without hunting, and the
            // safe-bottom utility keeps the buttons clear of the iOS home bar.
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-12px_32px_-16px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
          >
            <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-xl"
                aria-label={pickText(UI.back, lang)}
                onClick={goBack}
                disabled={idx === 0}
                ref={backButtonRef}
              >
                <ArrowLeft className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="h-12 rounded-xl"
                aria-label={pickText(UI.saveExit, lang)}
                onClick={manualSave}
                disabled={busy || !token}
              >
                <Save className="size-4" />
                <span className="ml-2 hidden sm:inline">{pickText(UI.saveExit, lang)}</span>
              </Button>
              {(() => {
                const requiredEmpty =
                  !!current && !!current.required && !isAnswered(current, answers);
                const formatErr =
                  !!current && validateAnswer(current, answers[current.id], lang) !== null;
                const blocked = requiredEmpty || formatErr;
                const keepFocusable =
                  !!current && blocked && focusableBlockedQuestionId === current.id;

                return (
                  <Button
                    size="lg"
                    // Primary CTA — taller (h-14 = 56px) than the secondary
                    // controls so the thumb finds it first, and slightly
                    // bolder text to match the visual weight increase.
                    className="h-14 flex-1 rounded-xl text-base font-semibold data-[blocked=true]:cursor-not-allowed data-[blocked=true]:opacity-50"
                    onClick={goNext}
                    disabled={busy || (blocked && !keepFocusable)}
                    aria-disabled={busy || blocked}
                    data-blocked={blocked || undefined}
                    data-testid="next-button"
                    ref={nextButtonRef}
                  >
                    {pickText(UI.next, lang)}
                    <ArrowRight className="ml-1 size-5" />
                  </Button>
                );
              })()}
            </div>
            {token && (
              <ResumeStrip
                surveySlug={survey.slug}
                resumeToken={token}
                label={pickText(UI.resumeLink, lang)}
                copyLabel={pickText(UI.copy, lang)}
                copiedLabel={pickText(UI.copied, lang)}
              />
            )}
          </nav>
        )}
      </FocusTrap>
    </div>
  );
}

// Silence unused-import warning when t() helper isn't referenced.
void t;
