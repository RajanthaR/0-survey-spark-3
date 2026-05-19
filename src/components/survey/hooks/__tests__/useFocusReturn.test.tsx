import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusReturn } from "../useFocusReturn";

function setup({
  enabled = true,
  focusKey = "q1",
  direction = 1 as 1 | -1,
  nextDisabled = false,
  backDisabled = false,
}: {
  enabled?: boolean;
  focusKey?: string;
  direction?: 1 | -1;
  nextDisabled?: boolean;
  backDisabled?: boolean;
} = {}) {
  const next = document.createElement("button");
  const back = document.createElement("button");
  next.disabled = nextDisabled;
  back.disabled = backDisabled;
  document.body.append(next, back);
  const nextFocus = vi.spyOn(next, "focus");
  const backFocus = vi.spyOn(back, "focus");

  const view = renderHook(() => {
    const nextButtonRef = useRef<HTMLButtonElement | null>(next);
    const backButtonRef = useRef<HTMLButtonElement | null>(back);
    useFocusReturn({ enabled, focusKey, direction, nextButtonRef, backButtonRef });
  });

  return { next, back, nextFocus, backFocus, view };
}

describe("useFocusReturn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("focuses the Next button when navigating forward", () => {
    const { nextFocus, backFocus } = setup({ direction: 1 });
    act(() => {
      vi.runAllTimers();
    });
    expect(nextFocus).toHaveBeenCalledWith({ preventScroll: true });
    expect(backFocus).not.toHaveBeenCalled();
  });

  it("focuses the Back button when navigating backward", () => {
    const { nextFocus, backFocus } = setup({ direction: -1 });
    act(() => {
      vi.runAllTimers();
    });
    expect(backFocus).toHaveBeenCalledWith({ preventScroll: true });
    expect(nextFocus).not.toHaveBeenCalled();
  });

  it("falls back to Back when Next is disabled", () => {
    const { nextFocus, backFocus } = setup({ direction: 1, nextDisabled: true });
    act(() => {
      vi.runAllTimers();
    });
    expect(nextFocus).not.toHaveBeenCalled();
    expect(backFocus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("does nothing when disabled", () => {
    const { nextFocus, backFocus } = setup({ enabled: false });
    act(() => {
      vi.runAllTimers();
    });
    expect(nextFocus).not.toHaveBeenCalled();
    expect(backFocus).not.toHaveBeenCalled();
  });

  it("does nothing when focusKey is missing", () => {
    const next = document.createElement("button");
    const back = document.createElement("button");
    document.body.append(next, back);
    const nextFocus = vi.spyOn(next, "focus");
    const backFocus = vi.spyOn(back, "focus");
    renderHook(() => {
      const nextButtonRef = useRef<HTMLButtonElement | null>(next);
      const backButtonRef = useRef<HTMLButtonElement | null>(back);
      useFocusReturn({
        enabled: true,
        focusKey: undefined,
        direction: 1,
        nextButtonRef,
        backButtonRef,
      });
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(nextFocus).not.toHaveBeenCalled();
    expect(backFocus).not.toHaveBeenCalled();
  });
});
