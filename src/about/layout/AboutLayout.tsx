import { useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { buildAboutBreadcrumbs } from "@/about/lib/navigation";
import { ABOUT_SECTIONS, getAboutSectionForPath } from "@/about/lib/sections";
import { buildDocSearchIndex, extractMarkdownTitle, loadDoc } from "@/about/lib/load-doc";
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
import { cn } from "@/lib/utils";

function docTitleFromSearch(search: unknown): string | undefined {
  if (!search || typeof search !== "object" || !("doc" in search)) return undefined;
  const doc = (search as { doc?: unknown }).doc;
  if (typeof doc !== "string") return undefined;
  return extractMarkdownTitle(loadDoc(doc), doc);
}

function AboutBreadcrumbs() {
  const { pathname, search } = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, search: state.location.search }),
  });
  const breadcrumbs = buildAboutBreadcrumbs({
    pathname,
    docTitle: docTitleFromSearch(search),
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <BreadcrumbItem key={`${crumb.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator />}
            {crumb.href ? (
              <BreadcrumbLink asChild>
                <Link to={crumb.href}>{crumb.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SectionNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = getAboutSectionForPath(pathname);
  const navigate = useNavigate();

  return (
    <>
      <nav className="hidden flex-col gap-1 lg:flex" aria-label="About lanes">
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
              <span className="font-medium">{section.label}</span>
              <span className="mt-1 block text-xs opacity-80">Lane {section.laneNumber}</span>
            </Link>
          );
        })}
      </nav>
      <div className="lg:hidden">
        <Select
          value={active?.path ?? "/about"}
          onValueChange={(value) => void navigate({ to: value })}
        >
          <SelectTrigger aria-label="Choose about lane">
            <SelectValue placeholder="Choose lane" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="/about">Hub</SelectItem>
              {ABOUT_SECTIONS.map((section) => (
                <SelectItem key={section.id} value={section.path}>
                  {section.label}
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
          Search docs
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search titles and headings..."
          />
          <CommandList>
            <CommandEmpty>No documents found.</CommandEmpty>
            <CommandGroup heading="Documents">
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
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/" className="text-sm font-semibold uppercase tracking-wider text-primary">
              EIP Insight
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">Research documentation explorer</p>
          </div>
          <DocSearch />
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
