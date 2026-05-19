import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStageMachine } from "../useStageMachine";
import type { Survey } from "@/surveys/types";

const survey: Survey = {
  slug: "demo",
  title: { en: "Demo", si: "Demo", ta: "Demo" },
  subtitle: { en: "Demo", si: "Demo", ta: "Demo" },
  estimatedMinutes: 1,
  consent: [],
  questions: [
    {
      id: "q1",
      type: "text",
      section: { en: "A", si: "A", ta: "A" },
      label: { en: "One", si: "One", ta: "One" },
    },
  ],
};

describe("useStageMachine", () => {
  it("starts resumed surveys at questions and supports edit jumps", () => {
    const { result } = renderHook(() =>
      useStageMachine({ survey, answers: {}, initialToken: "token" }),
    );
    expect(result.current.stage).toBe("questions");
    expect(result.current.current?.id).toBe("q1");

    act(() => result.current.setStage("review"));
    act(() => result.current.jumpToEdit("q1"));
    expect(result.current.stage).toBe("questions");
  });
});
