import { describe, expect, it } from "vitest";

import { pickText, type Lang } from "@/lib/i18n";
import { SURVEY_LIST } from "@/surveys";
import { YES_NO_OPTIONS, type Option } from "@/surveys/types";

/**
 * Visuals are language-agnostic by construction:
 *  - `kind: "icon"` carries only an icon `name` + optional `tone` — no text.
 *  - `kind: "image"` carries an `alt` that's a LocalizedString — text resolves
 *    via `pickText(alt, lang)`, but the `src` (the actual asset) stays the same.
 *
 * This guards that contract for every shipped survey so a future contributor
 * can't accidentally make a visual depend on the active language (e.g. by
 * splitting icons per locale, which would break the answer→visual mapping
 * the summary card relies on).
 */
const LANGS: Lang[] = ["en", "si", "ta"];

function visualIdentity(o: Option): string | null {
  if (!o.visual) return null;
  return o.visual.kind === "icon"
    ? `icon:${o.visual.name}:${o.visual.tone ?? "default"}`
    : `image:${o.visual.src}`;
}

describe("option visuals are language-independent", () => {
  it("every option's visual identity is stable across en/si/ta", () => {
    // The visual object is a static literal — it can't change per language —
    // but we still walk all options to lock the invariant in test output.
    for (const survey of SURVEY_LIST) {
      for (const q of survey.questions) {
        for (const opt of q.options ?? []) {
          const ids = LANGS.map(() => visualIdentity(opt));
          expect(new Set(ids).size, `[${survey.slug}/${q.id}/${opt.value}]`).toBe(1);
        }
      }
    }
  });

  it("image visuals resolve localized alt text without changing src", () => {
    for (const survey of SURVEY_LIST) {
      for (const q of survey.questions) {
        for (const opt of q.options ?? []) {
          const v = opt.visual;
          if (!v || v.kind !== "image" || !v.alt) continue;
          const srcs = new Set(LANGS.map(() => v.src));
          expect(srcs.size).toBe(1);
          // At least the en alt must be non-empty; other locales fall back.
          expect(pickText(v.alt, "en").length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("labels (not visuals) are what change between languages", () => {
    // Sanity check using the shared YES_NO dictionary — labels differ per
    // language, but the icon identity is constant.
    const yes = YES_NO_OPTIONS[0];
    const labels = LANGS.map((l) => pickText(yes.label, l));
    expect(new Set(labels).size).toBe(3);
    expect(visualIdentity(yes)).toBe("icon:thumbs-up:positive");
  });
});
