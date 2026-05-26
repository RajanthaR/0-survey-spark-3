import { describe, expect, it } from "vitest";

import adminAuthPath from "@/about/diagrams/admin-auth-path.mmd?raw";
import architectureOverview from "@/about/diagrams/architecture-overview.mmd?raw";
import i18nPipeline from "@/about/diagrams/i18n-pipeline.mmd?raw";
import rateLimit from "@/about/diagrams/rate-limit.mmd?raw";
import requestLifecycle from "@/about/diagrams/request-lifecycle.mmd?raw";
import surveyWritePath from "@/about/diagrams/survey-write-path.mmd?raw";
import { stripMermaidMetadata } from "@/about/lib/mermaid-source";

const DIAGRAMS = [
  ["architecture-overview.mmd", architectureOverview],
  ["request-lifecycle.mmd", requestLifecycle],
  ["survey-write-path.mmd", surveyWritePath],
  ["admin-auth-path.mmd", adminAuthPath],
  ["i18n-pipeline.mmd", i18nPipeline],
  ["rate-limit.mmd", rateLimit],
] as const;

describe("engineering Mermaid diagrams", () => {
  it.each(DIAGRAMS)("%s is non-empty and starts with a Mermaid header", (_name, source) => {
    const stripped = stripMermaidMetadata(source);

    expect(source.trim()).toMatch(/^<!--[\s\S]*?-->/);
    expect(stripped).toMatch(/^(flowchart|graph|sequenceDiagram|timeline)\b/);
  });
});
