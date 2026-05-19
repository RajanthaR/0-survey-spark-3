import { useEffect, type RefObject } from "react";

export function useFocusReturn({
  enabled,
  focusKey,
  direction,
  nextButtonRef,
  backButtonRef,
}: {
  enabled: boolean;
  focusKey?: string;
  direction: 1 | -1;
  nextButtonRef: RefObject<HTMLButtonElement | null>;
  backButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (!enabled || !focusKey) return;
    const id = window.setTimeout(() => {
      const target =
        direction === -1 && backButtonRef.current && !backButtonRef.current.disabled
          ? backButtonRef.current
          : nextButtonRef.current && !nextButtonRef.current.disabled
            ? nextButtonRef.current
            : backButtonRef.current;
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [backButtonRef, direction, enabled, focusKey, nextButtonRef]);
}
