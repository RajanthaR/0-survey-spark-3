import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSwipeNav } from "../useSwipeNav";

function Harness({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const handlers = useSwipeNav({ onNext, onBack, threshold: 40 });
  return <div data-testid="surface" {...handlers} />;
}

describe("useSwipeNav", () => {
  it("calls next on left swipe and back on right swipe", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    const { getByTestId } = render(<Harness onNext={onNext} onBack={onBack} />);
    const surface = getByTestId("surface");

    fireEvent.pointerDown(surface, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 100,
      clientY: 0,
    });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 40, clientY: 0 });
    fireEvent.pointerDown(surface, { pointerType: "touch", pointerId: 2, clientX: 40, clientY: 0 });
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 100, clientY: 0 });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
