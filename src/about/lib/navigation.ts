import { ABOUT_UI } from "@/about/copy/ui";
import { getAboutSectionForPath } from "@/about/lib/sections";
import { pickText, type Lang } from "@/lib/i18n";

export type AboutBreadcrumb = {
  label: string;
  href?: string;
};

export function buildAboutBreadcrumbs({
  pathname,
  docTitle,
  lang = "en",
}: {
  pathname: string;
  docTitle?: string;
  lang?: Lang;
}): AboutBreadcrumb[] {
  const section = getAboutSectionForPath(pathname);
  const aboutLabel = pickText(ABOUT_UI.breadcrumbAbout, lang);
  const breadcrumbs: AboutBreadcrumb[] = [{ label: aboutLabel, href: "/about" }];

  if (!section) {
    breadcrumbs[0] = { label: aboutLabel };
    return breadcrumbs;
  }

  breadcrumbs.push({
    label: pickText(ABOUT_UI.sections[section.id].label, lang),
    href: docTitle ? section.path : undefined,
  });

  if (docTitle) {
    breadcrumbs.push({ label: docTitle });
  }

  return breadcrumbs;
}
