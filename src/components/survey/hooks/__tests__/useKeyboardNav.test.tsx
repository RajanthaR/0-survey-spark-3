import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKeyboardNav } from "../useKeyboardNav";

describe("useKeyboardNav", () => {
  it("maps navigation keys to handlers", () => {
    const onFirst = vi.fn();
    const onLast = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();
    renderHook(() => useKeyboardNav({ enabled: true, onFirst, onLast, onNext, onBack }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));

    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onLast).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
