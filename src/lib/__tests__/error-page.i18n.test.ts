import { describe, expect, it } from "vitest";

import { renderErrorPage } from "@/lib/error-page";
import { pickText, UI, type Lang } from "@/lib/i18n";

describe("renderErrorPage", () => {
  it.each(["en", "si", "ta"] as Lang[])(
    "renders localized catastrophic error HTML for %s",
    (lang) => {
      const html = renderErrorPage(lang);

      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(pickText(UI.errorTitle, lang));
      expect(html).toContain(pickText(UI.errorBody, lang));
      expect(html).toContain(pickText(UI.retry, lang));
      expect(html).toContain(pickText(UI.goHome, lang));
      expect(html).toContain('id="main"');
    },
  );
});
