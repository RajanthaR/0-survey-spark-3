import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pickText, UI, type Lang } from "@/lib/i18n";
import type { Survey } from "@/surveys/types";

export function OptionalConsentPanel({
  items,
  lang,
  values,
  busy,
  onToggle,
  onBack,
  onContinue,
  verifyError,
  onRetryVerify,
  allowBypass,
  onBypass,
}: {
  items: Survey["consent"];
  lang: Lang;
  values: Record<string, boolean>;
  busy: boolean;
  onToggle: (id: string, value: boolean) => void;
  onBack: () => void;
  onContinue: () => void | Promise<void>;
  verifyError?: string | null;
  onRetryVerify?: () => void | Promise<void>;
  allowBypass?: boolean;
  onBypass?: () => void | Promise<void>;
}) {
  const allChecked = items.length > 0 && items.every((c) => !!values[c.id]);
  const triggeredRef = useRef(false);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Live-region announcement for screen readers, refreshed on every toggle.
  // The `nonce` forces React to re-render even when the user toggles the same
  // card to the same state twice, so AT will re-speak the message.
  const [announcement, setAnnouncement] = useState<{ text: string; nonce: number }>({
    text: "",
    nonce: 0,
  });
  const announceToggle = (id: string, nextChecked: boolean) => {
    const item = items.find((c) => c.id === id);
    const label = item ? pickText(item.label, lang) : "";
    const state = pickText(nextChecked ? UI.selected : UI.deselected, lang);
    setAnnouncement((prev) => ({ text: `${label} — ${state}`, nonce: prev.nonce + 1 }));
  };
  const toggleWithAnnounce = (id: string, nextChecked: boolean) => {
    announceToggle(id, nextChecked);
    onToggle(id, nextChecked);
  };
  const focusCard = (i: number) => {
    const len = items.length;
    if (len === 0) return;
    const next = ((i % len) + len) % len;
    cardRefs.current[next]?.focus();
  };
  const handleCardKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    id: string,
    checked: boolean,
  ) => {
    switch (e.key) {
      case " ":
      case "Spacebar":
      case "Enter":
        e.preventDefault();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(10);
          } catch {
            /* ignore */
          }
        }
        toggleWithAnnounce(id, !checked);
        break;
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        focusCard(index + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        focusCard(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusCard(0);
        break;
      case "End":
        e.preventDefault();
        focusCard(items.length - 1);
        break;
    }
  };
  useEffect(() => {
    // Skip auto-continue when a verification error is showing — the user
    // needs to read the message and tap "Try again" deliberately.
    if (allChecked && !triggeredRef.current && !busy && !verifyError) {
      triggeredRef.current = true;
      const id = setTimeout(() => {
        void onContinue();
      }, 250);
      return () => clearTimeout(id);
    }
    if (!allChecked) triggeredRef.current = false;
  }, [allChecked, busy, onContinue, verifyError]);

  return (
    <motion.section
      key="consent-optional"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-4"
    >
      <h2 className="text-xl font-semibold">{pickText(UI.optionalTitle, lang)}</h2>
      <p className="text-sm text-muted-foreground">{pickText(UI.optionalLead, lang)}</p>
      <p
        className="hidden text-xs text-muted-foreground sm:block"
        data-testid="optional-keyboard-hint"
      >
        {pickText(UI.optionalKeyboardHint, lang)}
      </p>
      <p className="text-xs text-muted-foreground sm:hidden" data-testid="optional-mobile-hint">
        {pickText(UI.optionalMobileHint, lang)}
      </p>
      <ul className="space-y-4" role="group" aria-label={pickText(UI.optionalTitle, lang)}>
        {items.map((c, index) => {
          const checked = !!values[c.id];
          const text = pickText(c.label, lang);
          const stateLabel = pickText(checked ? UI.selected : UI.tapToSelect, lang);
          return (
            <li key={c.id}>
              <button
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    try {
                      navigator.vibrate(10);
                    } catch {
                      /* ignore */
                    }
                  }
                  toggleWithAnnounce(c.id, !checked);
                }}
                onKeyDown={(e) => handleCardKeyDown(e, index, c.id, checked)}
                role="switch"
                aria-checked={checked}
                aria-label={`${text} — ${stateLabel}. ${pickText(UI.optionalCardAria, lang)}`}
                data-checked={checked ? "true" : "false"}
                className="rainbow-glow flex w-full flex-col gap-3 rounded-2xl border-2 border-transparent bg-card p-5 text-left min-h-[7rem] transition-[transform,border-color,box-shadow,background-color] active:scale-[0.99] hover:border-primary/30 focus:outline-none focus-visible:border-primary focus-visible:bg-accent/40 focus-visible:shadow-soft focus-visible:scale-[1.01] focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[checked=true]:border-primary/60"
              >
                <span className="block text-base leading-relaxed text-foreground">{text}</span>
                <span
                  aria-hidden="true"
                  className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-medium ${
                    checked
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {checked ? (
                    <>
                      <Check className="size-3.5" />
                      {pickText(UI.selected, lang)}
                    </>
                  ) : (
                    pickText(UI.tapToSelect, lang)
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* Toggle announcement: visually hidden, assertive so AT speaks each
          selection/deselection immediately. Keyed by `nonce` to re-announce
          repeats. */}
      <div
        key={announcement.nonce}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="optional-toggle-live"
        className="sr-only"
      >
        {announcement.text}
      </div>
      {(() => {
        const ready = items.some((c) => values[c.id]);
        return (
          <>
            {/* Always-visible idle hint while no card is selected. Plain
                text — no live region, so AT does not re-announce it. */}
            {!ready && (
              <p
                className="text-center text-sm text-muted-foreground"
                data-testid="optional-idle-hint"
              >
                {pickText(UI.optionalHintIdle, lang)}
              </p>
            )}
            {/* Polite announcement: only populated once the user has
                selected enough (≥1) optional cards. Empty before that, so
                screen readers stay silent until the threshold is met. */}
            <p
              className="text-center text-sm text-muted-foreground transition-colors"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="optional-ready-hint"
            >
              {ready ? pickText(UI.optionalHintReady, lang) : ""}
            </p>
          </>
        );
      })()}
      {verifyError && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="consent-verify-error"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold">{pickText(UI.verifyFailedTitle, lang)}</p>
              <p className="mt-1 text-destructive/90">{pickText(UI.verifyFailedLead, lang)}</p>
              <p className="mt-2 text-xs text-destructive/70">{verifyError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void onRetryVerify?.()}
            disabled={busy}
            data-testid="consent-verify-retry"
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            {pickText(UI.retry, lang)}
          </Button>
          {allowBypass && onBypass && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start rounded-xl text-xs text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void onBypass()}
              disabled={busy}
              data-testid="consent-verify-bypass"
            >
              Continue anyway (preview only)
            </Button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl"
          onClick={onBack}
          disabled={busy}
          aria-label={pickText(UI.back, lang)}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <Button
          size="lg"
          className="h-14 flex-1 rounded-2xl"
          onClick={() => void onContinue()}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : pickText(UI.continueLabel, lang)}
          <ArrowRight className="ml-2 size-5" />
        </Button>
      </div>
    </motion.section>
  );
}
