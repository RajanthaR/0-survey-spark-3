import { type ComponentProps, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from "lucide-react";

import { FocusTrap } from "@/components/FocusTrap";
import { LanguageToggle } from "@/components/LanguageToggle";
import { QuestionCount, QuestionPosition } from "@/components/QuestionCount";
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
import { pickText, UI, type Lang } from "@/lib/i18n";
import type { Question, Survey } from "@/surveys/types";
import { EMAIL_RE, isAnswered, validateAnswer } from "@/components/survey/validation";
import type { SurveyStage } from "@/components/survey/hooks/useStageMachine";
import { OptionalConsentPanel } from "@/components/survey/OptionalConsentPanel";
import { QuestionMap } from "@/components/survey/QuestionMap";
import { QuestionView } from "@/components/survey/QuestionView";
import { ResponseVisualSummary } from "@/components/survey/ResponseVisualSummary";
import { ResumeStrip } from "@/components/survey/ResumeStrip";
import { ReviewPanel } from "@/components/survey/ReviewPanel";

type Answers = Record<string, unknown>;
type Contact = { name: string; email: string; organization: string };
type SwipeHandlers = Pick<
  ComponentProps<"div">,
  "onPointerDown" | "onPointerUp" | "onPointerCancel"
>;

const AUTO_ADVANCE_DELAY_MS = 220;

interface SurveyRunnerViewProps {
  survey: Survey;
  lang: Lang;
  stage: SurveyStage;
  visible: Question[];
  current?: Question;
  idx: number;
  pct: number;
  skippedCount: number;
  answers: Answers;
  consent: Record<string, boolean>;
  contact: Contact;
  busy: boolean;
  token?: string;
  verifyError: string | null;
  navDirection: 1 | -1;
  validationError: string | null;
  nextButtonRef: RefObject<HTMLButtonElement | null>;
  backButtonRef: RefObject<HTMLButtonElement | null>;
  swipeHandlers: SwipeHandlers;
  onStart: () => void;
  onRequiredConsentAccepted: (ids: string[]) => void;
  onOptionalConsentToggle: (id: string, value: boolean) => void;
  onOptionalBack: () => void;
  onOptionalContinue: (opts?: { bypassTurnstile?: boolean }) => Promise<void>;
  onRetryVerify: () => Promise<void>;
  onBypassVerify: () => Promise<void>;
  onEdit: (id: string) => void;
  onQuestionChange: (value: unknown) => void;
  onAutoAdvance: () => void;
  onReviewContinue: () => void;
  onContactChange: (field: keyof Contact, value: string) => void;
  onContactBack: () => void;
  onSubmit: () => void;
  onQuestionBack: () => void;
  onManualSave: () => void;
  onQuestionNext: () => void;
}

export function SurveyRunnerView({
  survey,
  lang,
  stage,
  visible,
  current,
  idx,
  pct,
  skippedCount,
  answers,
  consent,
  contact,
  busy,
  token,
  verifyError,
  navDirection,
  validationError,
  nextButtonRef,
  backButtonRef,
  swipeHandlers,
  onStart,
  onRequiredConsentAccepted,
  onOptionalConsentToggle,
  onOptionalBack,
  onOptionalContinue,
  onRetryVerify,
  onBypassVerify,
  onEdit,
  onQuestionChange,
  onAutoAdvance,
  onReviewContinue,
  onContactChange,
  onContactBack,
  onSubmit,
  onQuestionBack,
  onManualSave,
  onQuestionNext,
}: SurveyRunnerViewProps) {
  const prefersReducedMotion = useReducedMotion();

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
                visible={visible}
                lang={lang}
                currentId={current?.id}
                onJump={onEdit}
              />
            )}
            <LanguageToggle compact />
          </div>
        </div>
        {stage === "questions" && (
          <div className="mx-auto max-w-2xl px-4 pb-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
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
                <span data-testid="progress-percent-chip" className="sr-only tabular-nums">
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
                <Button size="lg" className="h-14 w-full rounded-2xl text-base" onClick={onStart}>
                  {pickText(UI.start, lang)} <ArrowRight className="ml-2 size-5" />
                </Button>
              </motion.section>
            )}

            {stage === "consent" &&
              (() => {
                const required = survey.consent.filter((c) => c.required);
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
                      onClick={() => onRequiredConsentAccepted(required.map((c) => c.id))}
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
                    onToggle={onOptionalConsentToggle}
                    onBack={onOptionalBack}
                    onContinue={onOptionalContinue}
                    verifyError={verifyError}
                    onRetryVerify={onRetryVerify}
                    allowBypass={allowBypass}
                    onBypass={onBypassVerify}
                  />
                );
              })()}

            {stage === "questions" && current && (
              <div
                key={current.id}
                data-testid="question-swipe-surface"
                className="touch-pan-y"
                {...swipeHandlers}
              >
                <QuestionView
                  q={current}
                  value={answers[current.id]}
                  direction={navDirection}
                  onChange={(v) => {
                    onQuestionChange(v);
                    if (current.type === "single_choice" || current.type === "yes_no") {
                      setTimeout(onAutoAdvance, AUTO_ADVANCE_DELAY_MS);
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
                visible={visible}
                lang={lang}
                onEdit={onEdit}
                onContinue={onReviewContinue}
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
                      onChange={(e) => onContactChange("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{pickText(UI.emailLabel, lang)}</Label>
                    <Input
                      type="email"
                      className="mt-1 h-12"
                      value={contact.email}
                      onChange={(e) => onContactChange("email", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{pickText(UI.orgLabel, lang)}</Label>
                    <Input
                      className="mt-1 h-12"
                      value={contact.organization}
                      onChange={(e) => onContactChange("organization", e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-14 rounded-2xl"
                    onClick={onContactBack}
                    disabled={busy}
                  >
                    <ArrowLeft className="size-5" />
                  </Button>
                  <Button
                    size="lg"
                    className="h-14 flex-1 rounded-2xl"
                    onClick={onSubmit}
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

        {stage === "questions" && current && (
          <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-12px_32px_-16px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-xl"
                aria-label={pickText(UI.back, lang)}
                onClick={onQuestionBack}
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
                onClick={onManualSave}
                disabled={busy || !token}
              >
                <Save className="size-4" />
                <span className="ml-2 hidden sm:inline">{pickText(UI.saveExit, lang)}</span>
              </Button>
              {(() => {
                const requiredEmpty = !!current.required && !isAnswered(current, answers);
                const formatErr = validateAnswer(current, answers[current.id], lang) !== null;
                const blocked = requiredEmpty || formatErr;
                return (
                  <Button
                    size="lg"
                    className="h-14 flex-1 rounded-xl text-base font-semibold data-[blocked=true]:cursor-not-allowed data-[blocked=true]:opacity-50"
                    onClick={onQuestionNext}
                    disabled={busy || blocked}
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
