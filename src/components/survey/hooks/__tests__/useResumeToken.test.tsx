import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getStoredResumeToken } from "@/lib/resume-token-storage";
import { useResumeToken } from "../useResumeToken";

describe("useResumeToken", () => {
  it("persists and clears a token for the survey slug", () => {
    const { result } = renderHook(() => useResumeToken("phase-1"));

    act(() => result.current.persist("abc123456789"));
    expect(getStoredResumeToken("phase-1")).toBe("abc123456789");

    act(() => result.current.clear());
    expect(getStoredResumeToken("phase-1")).toBeUndefined();
  });
});
