import { useEffect } from "react";

export function useKeyboardNav({
  enabled,
  onFirst,
  onLast,
  onNext,
  onBack,
}: {
  enabled: boolean;
  onFirst: () => void;
  onLast: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable)
          return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        onFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        onLast();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onBack, onFirst, onLast, onNext]);
}
