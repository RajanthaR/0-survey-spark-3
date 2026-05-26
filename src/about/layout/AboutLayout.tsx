import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { ABOUT_UI, aboutLaneLabel } from "@/about/copy/ui";
import { buildAboutBreadcrumbs } from "@/about/lib/navigation";
import { ABOUT_SECTIONS, getAboutSectionForPath } from "@/about/lib/sections";
import { buildDocSearchIndex, extractMarkdownTitle, loadDoc } from "@/about/lib/load-doc";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { pickText, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function docTitleFromSearch(search: unknown): string | undefined {
  if (!search || typeof search !== "object" || !("doc" in search)) return undefined;
  const doc = (search as { doc?: unknown }).doc;
  if (typeof doc !== "string") return undefined;
  return extractMarkdownTitle(loadDoc(doc), doc);
}

function AboutBreadcrumbs() {
  const { lang } = useLang();
  const { pathname, search } = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, search: state.location.search }),
  });
  const breadcrumbs = buildAboutBreadcrumbs({
    pathname,
    docTitle: docTitleFromSearch(search),
    lang,
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link to={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SectionNav() {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = getAboutSectionForPath(pathname);
  const navigate = useNavigate();

  return (
    <>
      <nav
        className="hidden flex-col gap-1 lg:flex"
        aria-label={pickText(ABOUT_UI.navAriaLabel, lang)}
      >
        {ABOUT_SECTIONS.map((section) => {
          const isActive = active?.id === section.id;
          return (
            <Link
              key={section.id}
              to={section.path}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition hover:bg-accent/30",
                isActive
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="font-medium">
                {pickText(ABOUT_UI.sections[section.id].label, lang)}
              </span>
              <span className="mt-1 block text-xs opacity-80">
                {aboutLaneLabel(section.laneNumber, lang)}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="lg:hidden">
        <Select
          value={active?.path ?? "/about"}
          onValueChange={(value) => void navigate({ to: value })}
        >
          <SelectTrigger aria-label={pickText(ABOUT_UI.chooseLane, lang)}>
            <SelectValue placeholder={pickText(ABOUT_UI.chooseLane, lang)} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="/about">{pickText(ABOUT_UI.hubLabel, lang)}</SelectItem>
              {ABOUT_SECTIONS.map((section) => (
                <SelectItem key={section.id} value={section.path}>
                  {pickText(ABOUT_UI.sections[section.id].label, lang)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function DocSearch() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const index = useMemo(() => buildDocSearchIndex(), []);
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return index.slice(0, 8);
    return index.filter((entry) => entry.searchText.includes(normalizedQuery)).slice(0, 8);
  }, [index, normalizedQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground lg:w-72">
          <Search data-icon="inline-start" aria-hidden="true" />
          {pickText(ABOUT_UI.searchButton, lang)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={pickText(ABOUT_UI.searchPlaceholder, lang)}
          />
          <CommandList>
            <CommandEmpty>{pickText(ABOUT_UI.searchEmpty, lang)}</CommandEmpty>
            <CommandGroup heading={pickText(ABOUT_UI.searchGroup, lang)}>
              {results.map((entry) => (
                <CommandItem
                  key={entry.path}
                  value={entry.searchText}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                    void navigate({
                      to: "/about/engineering",
                      search: { doc: entry.path },
                    });
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.path}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AboutLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeSection = getAboutSectionForPath(pathname);
  const showLanguageToggle =
    activeSection?.id !== "research" && activeSection?.id !== "engineering";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/" className="text-sm font-semibold uppercase tracking-wider text-primary">
              {pickText(ABOUT_UI.appName, lang)}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {pickText(ABOUT_UI.shellSubtitle, lang)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <DocSearch />
            {showLanguageToggle && <LanguageToggle compact />}
          </div>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)]"
      >
        <aside className="flex flex-col gap-4">
          <SectionNav />
          <Separator className="hidden lg:block" />
        </aside>
        <div className="min-w-0">
          <div className="mb-6">
            <AboutBreadcrumbs />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
