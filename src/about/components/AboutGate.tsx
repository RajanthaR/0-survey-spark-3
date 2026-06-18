import { useCallback, useEffect, useState } from "react";
import { Delete, Leaf, Lock } from "lucide-react";

import { ABOUT_UI } from "@/about/copy/ui";
import { ABOUT_SECTIONS } from "@/about/lib/sections";
import {
  ABOUT_ACCESS_CODE,
  ABOUT_ACCESS_CODE_LENGTH,
  persistAboutUnlocked,
} from "@/about/lib/access-code";
import { pickText, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Code-entry screen shown in front of the About explorer. Renders a public
 * summary of what the explorer contains alongside an on-screen numerical
 * keypad. On the correct {@link ABOUT_ACCESS_CODE} it persists the per-session
 * unlock flag and calls `onUnlock`.
 *
 * Note: this is a soft, client-side gate (see access-code.ts) — it keeps
 * internal context away from casual/anonymous visitors, not a secret store.
 */
export function AboutGate({ onUnlock }: { onUnlock: () => void }) {
  const { lang } = useLang();
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);

  const submit = useCallback(
    (code: string) => {
      if (code === ABOUT_ACCESS_CODE) {
        persistAboutUnlocked();
        onUnlock();
      } else {
        setError(true);
        setEntry("");
      }
    },
    [onUnlock],
  );

  const pressDigit = useCallback(
    (digit: string) => {
      setError(false);
      setEntry((prev) => {
        if (prev.length >= ABOUT_ACCESS_CODE_LENGTH) return prev;
        const next = prev + digit;
        if (next.length === ABOUT_ACCESS_CODE_LENGTH) submit(next);
        return next;
      });
    },
    [submit],
  );

  const deleteLast = useCallback(() => {
    setError(false);
    setEntry((prev) => prev.slice(0, -1));
  }, []);

  // Hardware-keyboard parity: digits type, Backspace deletes. Keeps the gate
  // usable on desktop without forcing pointer use of the on-screen keypad.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        deleteLast();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressDigit, deleteLast]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center lg:py-16">
        {/* Public summary of what the gated explorer contains */}
        <section className="flex flex-col gap-5">
          <p className="glass-chip inline-flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Leaf className="size-4" aria-hidden="true" />
            {pickText(ABOUT_UI.gateEyebrow, lang)}
          </p>
          <h1 className="max-w-xl text-balance bg-gradient-to-br from-foreground via-primary to-primary-glow bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
            {pickText(ABOUT_UI.hubTitle, lang)}
          </h1>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {pickText(ABOUT_UI.hubDescription, lang)}
          </p>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {pickText(ABOUT_UI.gateSummaryHeading, lang)}
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {ABOUT_SECTIONS.map((section) => (
                <li key={section.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="font-display mt-0.5 select-none text-sm font-semibold text-primary/50"
                  >
                    {String(section.laneNumber).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {pickText(ABOUT_UI.sections[section.id].title, lang)}
                    </span>
                    <span className="block text-sm leading-6 text-muted-foreground">
                      {pickText(ABOUT_UI.sections[section.id].description, lang)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Code entry */}
        <section className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{pickText(ABOUT_UI.gateTitle, lang)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pickText(ABOUT_UI.gateDescription, lang)}
            </p>
          </div>

          {/* Entry indicator */}
          <div
            className="mt-6 flex justify-center gap-3"
            role="status"
            aria-label={pickText(ABOUT_UI.gatePrompt, lang)}
          >
            {Array.from({ length: ABOUT_ACCESS_CODE_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-4 rounded-full border transition",
                  i < entry.length ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}
              />
            ))}
          </div>

          <p
            className="mt-3 min-h-5 text-center text-sm font-medium text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {error ? pickText(ABOUT_UI.gateError, lang) : ""}
          </p>

          {/* On-screen numerical keypad */}
          <div
            className="mx-auto mt-2 grid max-w-xs grid-cols-3 gap-3"
            role="group"
            aria-label={pickText(ABOUT_UI.gateKeypadLabel, lang)}
          >
            {KEYPAD_DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => pressDigit(digit)}
                className="grid h-14 place-items-center rounded-2xl border bg-background text-xl font-semibold transition hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
              >
                {digit}
              </button>
            ))}
            <span aria-hidden="true" />
            <button
              type="button"
              onClick={() => pressDigit("0")}
              className="grid h-14 place-items-center rounded-2xl border bg-background text-xl font-semibold transition hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={deleteLast}
              disabled={entry.length === 0}
              aria-label={pickText(ABOUT_UI.gateDeleteLabel, lang)}
              className="grid h-14 place-items-center rounded-2xl border bg-background text-muted-foreground transition hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-40"
            >
              <Delete className="size-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
