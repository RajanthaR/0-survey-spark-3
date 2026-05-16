import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface FocusTrapProps {
  active: boolean;
  children: ReactNode;
  className?: string;
  /** Optional dependency that, when changed, re-runs initial focus. */
  focusKey?: string | number;
}

/**
 * Constrains keyboard Tab navigation to descendants of this container while
 * `active` is true. Used around the survey step (consent + question panels)
 * so keyboard users can't tab into background chrome (e.g. the language
 * toggle in the header).
 */
export function FocusTrap({ active, children, className, focusKey }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prevFocusKey = useRef<string | number | undefined>(focusKey);

  // Focus the first focusable descendant when activated / step changes.
  // The `contains` short-circuit only applies on initial activation — when
  // `focusKey` changes (i.e. the survey step advanced or rewound), we
  // ALWAYS re-focus so keyboard users land on the new step's primary
  // answer control instead of being stranded on the Back / Next button
  // that triggered the navigation.
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const focusKeyChanged = prevFocusKey.current !== focusKey;
    prevFocusKey.current = focusKey;
    if (!focusKeyChanged && node.contains(document.activeElement)) return;
    const focusables = Array.from(
      node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    focusables[0]?.focus();
  }, [active, focusKey]);

  // Cycle Tab / Shift+Tab within the container.
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.tabIndex !== -1);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = current ? node.contains(current) : false;
      if (e.shiftKey) {
        if (!inside || current === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", handler);
    return () => node.removeEventListener("keydown", handler);
  }, [active]);

  return (
    <div ref={ref} className={className} data-focus-trap={active ? "active" : "inactive"}>
      {children}
    </div>
  );
}
