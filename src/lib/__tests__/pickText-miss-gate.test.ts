import { describe, expect, it } from "vitest";

import { getPickTextMissCount, getPickTextMisses, pickText, resetPickTextMisses } from "@/lib/i18n";

describe("pickText miss accounting", () => {
  it("records missing non-English translations for the test teardown gate", () => {
    resetPickTextMisses();

    expect(pickText({ en: "English only" }, "si")).toBe("English only");
    expect(getPickTextMissCount()).toBe(1);
    expect(getPickTextMisses()).toEqual(["si:English only"]);

    resetPickTextMisses();
  });
});
