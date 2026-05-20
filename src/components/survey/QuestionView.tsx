import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pickText, useLang, UI, type Lang } from "@/lib/i18n";
import { type Question, YES_NO_OPTIONS } from "@/surveys/types";
import { OptionVisual } from "@/components/survey/OptionVisual";
import { questionHasVisuals } from "@/surveys/validate";

export type AnswerInputMeta = { source: "keyboard" | "pointer" | "programmatic" };

export function QuestionView({
  q,
  value,
  onChange,
  error,
  direction = 1,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown, meta?: AnswerInputMeta) => void;
  error: string | null;
  /** +1 = navigated forward, -1 = navigated back. Drives slide direction. */
  direction?: 1 | -1;
}) {
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Drives a brief fade-in of the *localized text* whenever the active
  // language flips. We re-trigger the CSS animation in place (remove
  // class → force reflow → re-add class) instead of changing a React
  // `key`, so NO DOM node remounts. The focused input keeps its caret,
  // value, and DOM identity, and the current step (question id) does
  // not advance. Honours `prefers-reduced-motion` (no animation).
  const prevLangRef = useRef<Lang>(lang);
  const [langEpoch, setLangEpoch] = useState(0);
  const textRef = useRef<HTMLDivElement | null>(null);
  // Banner ref participates in the language-fade replay so the error
  // summary re-fades alongside the question text on a language toggle.
  // Wraps the answer Field so the error-summary banner can scroll the
  // invalid field into view and shift focus to its first interactive
  // control. Built as a ref + DOM query (instead of forwarding refs
  // through every Field variant) so it works uniformly for inputs,
  // textareas, radio groups, and the pairwise grid.
  const fieldWrapRef = useRef<HTMLDivElement | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const prevErrorRef = useRef<string | null>(null);

  // Move focus + scroll the new question's heading into view whenever the
  // question changes. Screen-reader users hear the new question announced
  // via the focus move; sighted thumb-driven users see the page scroll back
  // to the top of the new card instead of staying parked at the previous
  // question's input. `scroll-mt-24` keeps the heading clear of the sticky
  // header. Honour `prefers-reduced-motion` for the scroll behaviour.
  useEffect(() => {
    const h = headingRef.current;
    if (!h) return;
    h.focus({ preventScroll: true });
    h.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [q.id, reduceMotion]);

  // Replay the fade-in on every language change after mount. Skips the
  // initial render so the card doesn't re-fade on first paint, and skips
  // entirely when the user prefers reduced motion.
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    setLangEpoch((n) => n + 1);
    if (reduceMotion) return;
    for (const el of [textRef.current, bannerRef.current]) {
      if (!el) continue;
      el.classList.remove("animate-fade-in");
      // Force a reflow so removing + re-adding the class restarts the
      // CSS animation. Reading offsetWidth is the cheapest portable way.
      void el.offsetWidth;
      el.classList.add("animate-fade-in");
    }
  }, [lang, reduceMotion]);

  // When validation fails on Next, draw the user's eye to the banner
  // and move focus into the invalid field so they can immediately fix
  // it. Only runs on the transition from "no error" → "error" so a
  // user editing the value (which clears the error) isn't yanked
  // around. Honours prefers-reduced-motion for the scroll behaviour.
  useEffect(() => {
    const prev = prevErrorRef.current;
    prevErrorRef.current = error;
    if (!error || prev === error) return;
    const banner = bannerRef.current;
    const wrap = fieldWrapRef.current;
    if (banner) {
      banner.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    }
    if (wrap) {
      // First focusable inside the answer field — input, textarea, or
      // the first option button for choice-style questions.
      const focusable = wrap.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [role="radio"]:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus({ preventScroll: true });
    }
  }, [error, reduceMotion]);

  const offset = reduceMotion ? 0 : 24 * direction;
  const fadeClass = reduceMotion ? "" : "animate-fade-in";

  return (
    <motion.section
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -offset }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
      className="space-y-4"
      // `data-lang` + `data-lang-epoch` are observable in tests so the
      // language-switch transition can be asserted without depending on
      // any animation library internals.
      data-lang={lang}
      data-lang-epoch={langEpoch}
    >
      {error && (
        <div
          ref={bannerRef}
          role="alert"
          aria-live="assertive"
          data-testid="error-summary"
          tabIndex={-1}
          className={`scroll-mt-24 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 ${fadeClass}`}
        >
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">
                {pickText(UI.errorSummaryTitle, lang)}
              </p>
              <p className="mt-0.5 text-sm leading-snug">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div ref={textRef} className={`space-y-3 ${fadeClass}`} data-testid="lang-fade-text">
        <div className="text-xs font-medium uppercase tracking-wider text-primary">
          {pickText(q.section, lang)}
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          // Generous scroll-margin so smooth-scroll lands the heading below
          // the sticky header, not behind it. Outline is suppressed because
          // the focus is programmatic (not from keyboard navigation).
          className="scroll-mt-24 text-pretty text-xl font-semibold leading-snug outline-none"
        >
          {pickText(q.label, lang)}
          {q.required ? <span className="ml-1 text-destructive">*</span> : null}
        </h2>
        {/* Help text is rendered as a plain string child so React auto-escapes
            any HTML — safe even if survey JSON is later loaded dynamically. */}
        {q.help && <p className="text-sm text-muted-foreground">{pickText(q.help, lang)}</p>}
      </div>

      {/* Field renders normally — the fade-in is re-triggered in place
          on its siblings (see useEffect above) so the input is never
          remounted on a language switch. */}
      <div ref={fieldWrapRef} data-testid="question-field" aria-invalid={!!error || undefined}>
        <Field q={q} value={value} onChange={onChange} lang={lang} />
      </div>
    </motion.section>
  );
}

function Field({
  q,
  value,
  onChange,
  lang,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown, meta?: AnswerInputMeta) => void;
  lang: Lang;
}) {
  const lastChoiceInputRef = useRef<AnswerInputMeta["source"]>("programmatic");

  switch (q.type) {
    case "single_choice":
    case "yes_no": {
      const opts = q.type === "yes_no" ? YES_NO_OPTIONS : (q.options ?? []);
      const hasVisuals = questionHasVisuals(opts);
      return (
        <div className="grid gap-2" role="radiogroup">
          {opts.map((o) => {
            const active = String(value ?? "") === o.value;
            return (
              <motion.button
                whileTap={{ scale: 0.98 }}
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onPointerDown={() => {
                  lastChoiceInputRef.current = "pointer";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                    lastChoiceInputRef.current = "keyboard";
                  }
                }}
                onClick={() => {
                  const source = lastChoiceInputRef.current;
                  lastChoiceInputRef.current = "programmatic";
                  onChange(o.value, { source });
                }}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent/30"
                }`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full border ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {active && <Check className="size-3.5" />}
                </span>
                {hasVisuals && <OptionVisual visual={o.visual} active={active} />}
                <span className="text-sm">{pickText(o.label, lang)}</span>
              </motion.button>
            );
          })}
        </div>
      );
    }
    case "multi_choice": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const max = q.maxSelect;
      const hasVisuals = questionHasVisuals(q.options);
      return (
        <div className="grid gap-2">
          {(q.options ?? []).map((o) => {
            const active = arr.includes(o.value);
            return (
              <motion.button
                whileTap={{ scale: 0.98 }}
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (active) onChange(arr.filter((v) => v !== o.value));
                  else if (!max || arr.length < max) onChange([...arr, o.value]);
                }}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-md border ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {active && <Check className="size-3.5" />}
                </span>
                {hasVisuals && <OptionVisual visual={o.visual} active={active} />}
                <span className="text-sm">{pickText(o.label, lang)}</span>
              </motion.button>
            );
          })}
          {max && (
            <p className="text-xs text-muted-foreground">
              {arr.length}/{max}
            </p>
          )}
        </div>
      );
    }
    case "likert_5": {
      const cur = String(value ?? "");
      // Likert options carry icons (Frown→Laugh) defined in LIKERT_5. The
      // visual is supplementary; the numeral remains the actual label and
      // the source of the screen-reader announcement.
      const faces = q.options ?? [];
      const hasVisuals = questionHasVisuals(faces);
      return (
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n, i) => {
            const active = cur === String(n);
            const face = hasVisuals ? faces[i] : undefined;
            const label = face?.label ? pickText(face.label, lang) : String(n);
            return (
              <motion.button
                whileTap={{ scale: 0.94 }}
                key={n}
                type="button"
                aria-label={`${n}: ${label}`}
                aria-pressed={active}
                onClick={() => onChange(String(n))}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-base font-semibold transition ${
                  active ? "gradient-eco text-primary-foreground border-transparent" : "bg-card"
                }`}
              >
                {face && <OptionVisual visual={face.visual} active={active} size="sm" />}
                {n}
              </motion.button>
            );
          })}
        </div>
      );
    }
    case "long_text":
      return (
        <Textarea
          rows={4}
          placeholder={pickText(q.placeholder ?? UI.placeholderLongText, lang)}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "text":
    case "email":
    case "tel":
      return (
        <Input
          type={q.type === "email" ? "email" : q.type === "tel" ? "tel" : "text"}
          inputMode={q.type === "tel" ? "tel" : q.type === "email" ? "email" : "text"}
          autoComplete={q.type === "email" ? "email" : q.type === "tel" ? "tel" : "off"}
          className="h-12"
          placeholder={pickText(
            q.placeholder ??
              (q.type === "email"
                ? UI.placeholderEmail
                : q.type === "tel"
                  ? UI.placeholderTel
                  : UI.placeholderText),
            lang,
          )}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number_range":
      return (
        <Input
          type="number"
          inputMode="numeric"
          className="h-12"
          placeholder={pickText(q.placeholder ?? UI.placeholderNumber, lang)}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "geo":
      return (
        <Input
          className="h-12"
          placeholder={pickText(q.placeholder ?? UI.placeholderGeo, lang)}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "pairwise_saaty": {
      const obj = (value as Record<string, string>) ?? {};
      const crits = q.criteria ?? [];
      const pairs: { a: string; b: string }[] = [];
      for (let i = 0; i < crits.length; i++) {
        for (let j = i + 1; j < crits.length; j++) pairs.push({ a: crits[i].key, b: crits[j].key });
      }
      return (
        <div className="space-y-4">
          {pairs.map(({ a, b }) => {
            const k = `${a}__${b}`;
            const ca = crits.find((c) => c.key === a)!;
            const cb = crits.find((c) => c.key === b)!;
            return (
              <div key={k} className="rounded-2xl border bg-card p-3">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{pickText(ca.label, lang)}</span>
                  <span className="font-medium">{pickText(cb.label, lang)}</span>
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {[9, 7, 5, 3, 1, 3, 5, 7, 9].map((n, i) => {
                    const sign = i < 4 ? "a" : i > 4 ? "b" : "eq";
                    const id = sign === "eq" ? "eq" : `${sign}${n}`;
                    const active = obj[k] === id;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange({ ...obj, [k]: id })}
                        className={`grid h-10 place-items-center rounded-lg border text-xs font-semibold ${
                          active
                            ? "gradient-eco text-primary-foreground border-transparent"
                            : "bg-background"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}
