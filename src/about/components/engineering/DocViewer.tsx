import { Link } from "@tanstack/react-router";

import { MarkdownView } from "@/about/components/MarkdownView";
import { extractMarkdownTitle, loadDoc } from "@/about/lib/load-doc";
import { Button } from "@/components/ui/button";

export const DEFAULT_ENGINEERING_DOC = "docs/DEPLOYMENT.md";

export function DocViewer({ doc }: { doc: string }) {
  const source = loadDoc(doc);

  if (!source) {
    return (
      <div role="alert" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Document not found</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The requested Markdown file is not available in the tracked explorer corpus.
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs">
            {doc}
          </code>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link to="/about/engineering" search={{ mode: "browser", doc: DEFAULT_ENGINEERING_DOC }}>
            Open deployment runbook
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <article className="flex min-w-0 flex-col gap-5">
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
