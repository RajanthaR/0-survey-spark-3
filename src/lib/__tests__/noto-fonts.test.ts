import { beforeEach, describe, expect, it } from "vitest";

import {
  NOTO_FONT_STYLESHEET_HREF,
  NOTO_FONT_STYLESHEET_ID,
  ensureNotoFontsForLang,
  shouldLoadNotoFonts,
} from "@/lib/noto-fonts";

describe("Noto Sinhala/Tamil font loader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("does not inject fonts for English", () => {
    expect(shouldLoadNotoFonts("en")).toBe(false);
    expect(ensureNotoFontsForLang("en")).toBe(false);
    expect(document.querySelectorAll("link[data-noto-fonts='true']")).toHaveLength(0);
  });

  it("injects preconnects and the stylesheet for Sinhala/Tamil once", () => {
    expect(ensureNotoFontsForLang("si")).toBe(true);
    expect(ensureNotoFontsForLang("ta")).toBe(false);

    const links = document.querySelectorAll("link[data-noto-fonts='true']");
    expect(links).toHaveLength(3);
    expect(document.getElementById(NOTO_FONT_STYLESHEET_ID)).toHaveAttribute(
      "href",
      NOTO_FONT_STYLESHEET_HREF,
    );
  });
});
