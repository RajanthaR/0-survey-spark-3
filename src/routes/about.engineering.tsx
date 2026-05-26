import { createFileRoute } from "@tanstack/react-router";

import { LanePlaceholder } from "@/about/components/LanePlaceholder";
import { MarkdownView } from "@/about/components/MarkdownView";
import { extractMarkdownTitle, loadDoc } from "@/about/lib/load-doc";
import { getAboutSection } from "@/about/lib/sections";

export const Route = createFileRoute("/about/engineering")({
  validateSearch: (search: Record<string, unknown>) => ({
    doc: typeof search.doc === "string" ? search.doc : undefined,
  }),
  component: EngineeringLane,
  head: () => ({
    meta: [
      { title: "Engineering lane - EIP Insight" },
      { name: "description", content: getAboutSection("engineering").description },
    ],
  }),
});

function EngineeringLane() {
  const { doc } = Route.useSearch();
  const source = doc ? loadDoc(doc) : undefined;

  if (doc && source) {
    return (
      <article className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Engineering document
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            {extractMarkdownTitle(source, doc)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{doc}</p>
        </div>
        <MarkdownView source={source} basePath={doc} />
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {doc && (
        <div role="alert" className="rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Document not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The requested Markdown file is not available in the tracked explorer corpus:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{doc}</code>
          </p>
        </div>
      )}
      <LanePlaceholder section={getAboutSection("engineering")} />
    </div>
  );
}
