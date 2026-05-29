import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { I18nProvider, pickText, UI } from "@/lib/i18n";
import { QuestionView } from "@/components/survey/QuestionView";
import type { Question } from "@/surveys/types";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  // Cache one passthrough component per tag. Real framer-motion exposes
  // stable component identities, so `motion.button` must return the SAME
  // component across renders — otherwise React remounts the subtree on
  // every keystroke and the focused text input is blurred mid-typing.
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const passthrough = (tag: string) => {
    const cached = cache.get(tag);
    if (cached) return cached;
    const C = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
      React.createElement(tag, { ...props, ref }),
    );
    cache.set(tag, C);
    return C;
  };
  return {
    motion: new Proxy({}, { get: (_target, key: string) => passthrough(key) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

const otherLabel = pickText(UI.optionOther, "en");

const SINGLE: Question = {
  id: "single",
  type: "single_choice",
  section: { en: "Section", si: "අංශය", ta: "பிரிவு" },
  label: { en: "Pick one", si: "එකක් තෝරන්න", ta: "ஒன்றைத் தேர்வு" },
  allowOther: true,
  options: [{ value: "a", label: { en: "Apple", si: "ඇපල්", ta: "ஆப்பிள்" } }],
};

const MULTI: Question = {
  id: "multi",
  type: "multi_choice",
  section: { en: "Section", si: "අංශය", ta: "பிரிவு" },
  label: { en: "Pick some", si: "කිහිපයක් තෝරන්න", ta: "சிலவற்றைத் தேர்வு" },
  allowOther: true,
  options: [{ value: "a", label: { en: "Apple", si: "ඇපල්", ta: "ஆப்பிள்" } }],
};

function ControlledHarness({ q }: { q: Question }) {
  const [value, setValue] = useState<unknown>(undefined);
  return (
    <I18nProvider initialLang="en">
      <QuestionView q={q} value={value} onChange={(v) => setValue(v)} error={null} />
      <output data-testid="value">{JSON.stringify(value ?? null)}</output>
    </I18nProvider>
  );
}

describe("QuestionView allowOther", () => {
  it("does not render an Other control when allowOther is absent", () => {
    render(<ControlledHarness q={{ ...SINGLE, allowOther: undefined }} />);
    expect(screen.queryByRole("radio", { name: otherLabel })).not.toBeInTheDocument();
  });

  it("single_choice: selecting Other reveals a text field that encodes free text", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness q={SINGLE} />);

    // Text field hidden until Other is chosen.
    expect(screen.queryByLabelText(otherLabel)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: otherLabel }));
    expect(screen.getByTestId("value")).toHaveTextContent('"other"');

    await user.type(screen.getByLabelText(otherLabel), "Mango");
    expect(screen.getByTestId("value")).toHaveTextContent('"other:Mango"');
  });

  it("single_choice: choosing a real option after Other clears the free text", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness q={SINGLE} />);

    await user.click(screen.getByRole("radio", { name: otherLabel }));
    await user.type(screen.getByLabelText(otherLabel), "Mango");
    await user.click(screen.getByRole("radio", { name: "Apple" }));

    expect(screen.getByTestId("value")).toHaveTextContent('"a"');
    expect(screen.queryByLabelText(otherLabel)).not.toBeInTheDocument();
  });

  it("multi_choice: Other coexists with real selections and carries free text", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness q={MULTI} />);

    await user.click(screen.getByRole("button", { name: "Apple" }));
    await user.click(screen.getByRole("button", { name: otherLabel }));
    expect(screen.getByTestId("value")).toHaveTextContent('["a","other"]');

    await user.type(screen.getByLabelText(otherLabel), "Kiwi");
    expect(screen.getByTestId("value")).toHaveTextContent('["a","other:Kiwi"]');

    // Toggling Other off removes only the other entry.
    await user.click(screen.getByRole("button", { name: otherLabel }));
    expect(screen.getByTestId("value")).toHaveTextContent('["a"]');
  });
});
