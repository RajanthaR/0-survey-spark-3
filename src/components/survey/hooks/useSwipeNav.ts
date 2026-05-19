import { useCallback, useRef, type PointerEvent } from "react";

const SWIPE_DIRECTION_THRESHOLD = 1.2;

function isInteractiveTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    target.isContentEditable ||
    !!target.closest("[data-no-swipe]")
  );
}

export function useSwipeNav({
  onNext,
  onBack,
  threshold = 48,
}: {
  onNext: () => void;
  onBack: () => void;
  threshold?: number;
}) {
  const swipe = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    if (isInteractiveTarget(e.target as HTMLElement | null)) return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: true };
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const start = swipe.current;
      if (!start || start.id !== e.pointerId || !start.active) return;
      swipe.current = null;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_THRESHOLD) return;
      if (dx < 0) onNext();
      else onBack();
    },
    [onBack, onNext, threshold],
  );

  const onPointerCancel = useCallback(() => {
    swipe.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
