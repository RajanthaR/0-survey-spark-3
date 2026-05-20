import type { Lang } from "@/lib/i18n";

export const NOTO_FONT_STYLESHEET_ID = "noto-si-ta-fonts";
const GOOGLE_PRECONNECT_ID = "noto-fonts-googleapis";
const GSTATIC_PRECONNECT_ID = "noto-fonts-gstatic";

export const NOTO_FONT_STYLESHEET_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap";

export function shouldLoadNotoFonts(lang: Lang): boolean {
  return lang === "si" || lang === "ta";
}

export function ensureNotoFontsForLang(lang: Lang): boolean {
  if (!shouldLoadNotoFonts(lang) || typeof document === "undefined") return false;

  ensureLink(GOOGLE_PRECONNECT_ID, {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  });
  ensureLink(GSTATIC_PRECONNECT_ID, {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  });
  return ensureLink(NOTO_FONT_STYLESHEET_ID, {
    rel: "stylesheet",
    href: NOTO_FONT_STYLESHEET_HREF,
  });
}

function ensureLink(
  id: string,
  attrs: { rel: string; href: string; crossOrigin?: "anonymous" },
): boolean {
  if (document.getElementById(id)) return false;
  const link = document.createElement("link");
  link.id = id;
  link.rel = attrs.rel;
  link.href = attrs.href;
  link.dataset.notoFonts = "true";
  if (attrs.crossOrigin) link.crossOrigin = attrs.crossOrigin;
  document.head.appendChild(link);
  return true;
}
