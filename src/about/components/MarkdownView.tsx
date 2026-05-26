import { isValidElement, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/about/components/MermaidBlock";
import { stripMermaidMetadata } from "@/about/lib/mermaid-source";

const GITHUB_BLOB_BASE = "https://github.com/RajanthaR/survey-spark-3/blob";
const COMMIT_SHA = typeof __COMMIT_SHA__ === "string" ? __COMMIT_SHA__ : "main";
const IN_APP_DOC_PREFIXES = ["docs/", "audits/", "Codex-audits/", "Plans/"];

function isExternalHref(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("#");
}

function normalizeRepoLink(href: string, basePath: string): string {
  const [rawPath, hash = ""] = href.split("#", 2);
  const baseParts = basePath.replace(/\\/g, "/").split("/");
  baseParts.pop();
  const cleanPath = rawPath.replace(/^\//, "");
  const isRepoRootPath =
    rawPath.startsWith("/") || IN_APP_DOC_PREFIXES.some((prefix) => cleanPath.startsWith(prefix));
  const parts = isRepoRootPath ? [] : baseParts;

  for (const part of cleanPath.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }

  const normalized = parts.join("/");
  return `${normalized}${hash ? `#${hash}` : ""}`;
}

export function rewriteMarkdownHref(
  href: string | undefined,
  basePath: string,
): string | undefined {
  if (!href || isExternalHref(href)) return href;
  const repoPath = normalizeRepoLink(href, basePath);
  const [pathOnly, hash = ""] = repoPath.split("#", 2);
  if (/\.md$/i.test(pathOnly)) {
    const encodedDoc = encodeURIComponent(pathOnly);
    return `/about/engineering?mode=browser&doc=${encodedDoc}${hash ? `#${hash}` : ""}`;
  }
  return `${GITHUB_BLOB_BASE}/${COMMIT_SHA}/${encodeURI(pathOnly)}${hash ? `#${hash}` : ""}`;
}

function textFromNode(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement(node)) {
    return textFromNode((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

const components = (basePath: string): Components => ({
  a({ href, children, node: _node, ...props }) {
    return (
      <a href={rewriteMarkdownHref(href, basePath)} {...props}>
        {children}
      </a>
    );
  },
  pre({ children, node: _node, ...props }) {
    if (isValidElement(children)) {
      const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
      if (child.props.className?.split(/\s+/).includes("language-mermaid")) {
        return (
          <MermaidBlock
            source={stripMermaidMetadata(textFromNode(child.props.children).replace(/\n$/, ""))}
          />
        );
      }
    }
    return <pre {...props}>{children}</pre>;
  },
});

export function stripMarkdownComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

export function MarkdownView({ source, basePath }: { source: string; basePath: string }) {
  return (
    <div className="markdown-view">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components(basePath)}>
        {stripMarkdownComments(source)}
      </ReactMarkdown>
    </div>
  );
}
