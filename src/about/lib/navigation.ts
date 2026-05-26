import { getAboutSectionForPath } from "@/about/lib/sections";

export type AboutBreadcrumb = {
  label: string;
  href?: string;
};

export function buildAboutBreadcrumbs({
  pathname,
  docTitle,
}: {
  pathname: string;
  docTitle?: string;
}): AboutBreadcrumb[] {
  const section = getAboutSectionForPath(pathname);
  const breadcrumbs: AboutBreadcrumb[] = [{ label: "About", href: "/about" }];

  if (!section) {
    breadcrumbs[0] = { label: "About" };
    return breadcrumbs;
  }

  breadcrumbs.push({
    label: section.label,
    href: docTitle ? section.path : undefined,
  });

  if (docTitle) {
    breadcrumbs.push({ label: docTitle });
  }

  return breadcrumbs;
}
