import { useMemo } from "react";

import { MarkdownView } from "@/about/components/MarkdownView";
import storyTemplate from "@/about/content/engineering/architecture-story.md?raw";
import adminAuthPath from "@/about/diagrams/admin-auth-path.mmd?raw";
import architectureOverview from "@/about/diagrams/architecture-overview.mmd?raw";
import i18nPipeline from "@/about/diagrams/i18n-pipeline.mmd?raw";
import rateLimit from "@/about/diagrams/rate-limit.mmd?raw";
import requestLifecycle from "@/about/diagrams/request-lifecycle.mmd?raw";
import surveyWritePath from "@/about/diagrams/survey-write-path.mmd?raw";
import { stripMermaidMetadata } from "@/about/lib/mermaid-source";

const DIAGRAMS: Record<string, string> = {
  "admin-auth-path": adminAuthPath,
  "architecture-overview": architectureOverview,
  "i18n-pipeline": i18nPipeline,
  "rate-limit": rateLimit,
  "request-lifecycle": requestLifecycle,
  "survey-write-path": surveyWritePath,
};

function mermaidFence(source: string): string {
  return ["```mermaid", stripMermaidMetadata(source), "```"].join("\n");
}

function buildStoryMarkdown(): string {
  return Object.entries(DIAGRAMS).reduce(
    (markdown, [key, source]) => markdown.replace(`{{${key}}}`, mermaidFence(source)),
    storyTemplate,
  );
}

export default function EngineeringStoryMode() {
  const source = useMemo(() => buildStoryMarkdown(), []);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <MarkdownView
        source={source}
        basePath="src/about/content/engineering/architecture-story.md"
      />
    </article>
  );
}
