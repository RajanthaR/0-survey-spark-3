import { Link } from "@tanstack/react-router";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { extractMarkdownTitle, listDocs, loadDoc } from "@/about/lib/load-doc";
import { cn } from "@/lib/utils";

type DocGroup = {
  label: string;
  prefix: string;
};

const DOC_GROUPS: DocGroup[] = [
  { label: "docs/", prefix: "docs/" },
  { label: "audits/", prefix: "audits/" },
  { label: "Codex-audits/", prefix: "Codex-audits/" },
  { label: "Plans/", prefix: "Plans/" },
];

const GROUPED_DOCS = DOC_GROUPS.map((group) => ({
  ...group,
  docs: listDocs(group.prefix).map((path) => ({
    path,
    title: extractMarkdownTitle(loadDoc(path), path),
  })),
}));

export function DocSidebar({ activeDoc }: { activeDoc: string }) {
  return (
    <nav aria-label="Engineering documents" className="rounded-lg border bg-card">
      <ScrollArea className="h-[min(72vh,46rem)]">
        <Accordion type="multiple" defaultValue={DOC_GROUPS.map((group) => group.prefix)}>
          {GROUPED_DOCS.map((group) => (
            <AccordionItem key={group.prefix} value={group.prefix} className="px-3">
              <AccordionTrigger className="py-3 text-xs uppercase tracking-wide text-muted-foreground hover:no-underline">
                {group.label}
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-1 pb-3">
                {group.docs.map((doc) => {
                  const isActive = doc.path === activeDoc;
                  return (
                    <Link
                      key={doc.path}
                      to="/about/engineering"
                      search={{ mode: "browser", doc: doc.path }}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-sm transition hover:bg-accent/30",
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                      title={doc.path}
                    >
                      <span className="block truncate font-medium">{doc.title}</span>
                      <span className="block truncate text-xs opacity-80">{doc.path}</span>
                    </Link>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </nav>
  );
}
