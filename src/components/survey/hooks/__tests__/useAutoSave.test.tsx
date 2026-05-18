import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAutoSave } from "../useAutoSave";

describe("useAutoSave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces saves", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutoSave({
        enabled: true,
        payload: { answers: { q1: "yes" }, progressPct: 50, language: "en" },
        debounceMs: 100,
        save,
      }),
    );

    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(99);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(save).toHaveBeenCalledWith({
      answers: { q1: "yes" },
      progressPct: 50,
      language: "en",
    });
  });
});
