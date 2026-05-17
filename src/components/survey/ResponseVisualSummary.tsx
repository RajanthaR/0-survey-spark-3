import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { OptionVisual } from "@/components/survey/OptionVisual";
import { pickText, UI, useLang, type Lang } from "@/lib/i18n";
import { visibleQuestions } from "@/lib/survey-logic";
import { type Option, type Question, type Survey, YES_NO_OPTIONS } from "@/surveys/types";

type Answers = Record<string, unknown>;

function optionsFor(q: Question): Option[] {
  if (q.type === "yes_no") return YES_NO_OPTIONS;
  return q.options ?? [];
}

function selectedOptions(q: Question, value: unknown): Option[] {
  const opts = optionsFor(q);
  if (opts.length === 0 || value == null || value === "") return [];
  const values = Array.isArray(value) ? value.map(String) : [String(value)];
  return values.map((v) => opts.find((o) => o.value === v)).filter((o): o is Option => Boolean(o));
}

/**
 * Renders the just-completed response as a list of expandable rows. Each
 * question collapses to a strip of icons (mobile-friendly: no horizontal
 * overflow at 320px); tap reveals the icon + label chips.
 *
 * Skips questions whose options carry no visual so it stays a *visual*
 * recap rather than re-stating the review step.
 *
 * @param lang  Override the i18n language. Useful for the admin viewer,
 *              which renders a respondent's completed survey in the
 *              language they chose, regardless of admin UI language.
 * @param defaultExpanded  If true, all rows start expanded. Default false
 *              so the card stays compact on small viewports.
 * @param ariaLabel  Override the section aria-label (defaults to the
 *              localized "Your selections" heading).
 */
export function ResponseVisualSummary({
  survey,
  answers,
  lang: langOverride,
  defaultExpanded = false,
  ariaLabel,
}: {
  survey: Survey;
  answers: Answers;
  lang?: Lang;
  defaultExpanded?: boolean;
  ariaLabel?: string;
}) {
  const ctx = useLang();
  const lang = langOverride ?? ctx.lang;
  const reduceMotion = useReducedMotion();
  const visible = visibleQuestions(survey, answers);

  const rows = visible
    .map((q) => {
      const opts = optionsFor(q);
      const allHaveVisuals = opts.length > 0 && opts.every((o) => o.visual);
      if (!allHaveVisuals) return null;
      const picked = selectedOptions(q, answers[q.id]);
      if (picked.length === 0) return null;
      return { q, picked };
    })
    .filter((r): r is { q: Question; picked: Option[] } => r !== null);

  if (rows.length === 0) return null;

  const heading = pickText(UI.responseVisualHeading, lang);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : 0.15, duration: 0.2 }}
      className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-4 text-left shadow-soft"
      aria-label={ariaLabel ?? heading}
      data-testid="response-visual-summary"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
        {heading}
      </h3>
      <ul className="space-y-2">
        {rows.map(({ q, picked }) => (
          <SummaryRow
            key={q.id}
            question={q}
            picked={picked}
            lang={lang}
            defaultExpanded={defaultExpanded}
            tapHint={pickText(UI.responseVisualTapHint, lang)}
            reduceMotion={!!reduceMotion}
          />
        ))}
      </ul>
    </motion.section>
  );
}

function SummaryRow({
  question,
  picked,
  lang,
  defaultExpanded,
  tapHint,
  reduceMotion,
}: {
  question: Question;
  picked: Option[];
  lang: Lang;
  defaultExpanded: boolean;
  tapHint: string;
  reduceMotion: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const id = `summary-row-${question.id}`;
  const label = pickText(question.label, lang);

  return (
    <li
      className="overflow-hidden rounded-xl border bg-background"
      data-testid={`summary-row-${question.id}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        // 44px+ touch target for thumb-zone tapping on phones.
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
      >
        {/* Compact icon strip — survives small viewports because it caps
            at 4 visible icons + a "+N" overflow chip rather than wrapping. */}
        <span className="flex shrink-0 -space-x-1.5">
          {picked.slice(0, 4).map((opt, i) => (
            <span
              key={opt.value}
              className="rounded-full ring-2 ring-card"
              style={{ zIndex: 4 - i }}
            >
              <OptionVisual visual={opt.visual} size="sm" />
            </span>
          ))}
          {picked.length > 4 && (
            <span className="grid size-8 place-items-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">
              +{picked.length - 4}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted-foreground">{label}</span>
          <span className="text-[11px] text-muted-foreground/70">{open ? "" : tapHint}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="content"
            // Animate only opacity + a cheap transform on low-end devices.
            // Animating `height: auto` triggers per-frame layout on every
            // ancestor — fine on desktop, janky on a 320–450px budget phone.
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            style={{ willChange: "opacity, transform" }}
          >
            <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
              {picked.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-2 py-1 text-xs"
                >
                  <OptionVisual visual={opt.visual} size="sm" />
                  <span className="pr-1">{pickText(opt.label, lang)}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
