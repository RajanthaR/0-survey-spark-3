const LEADING_HTML_COMMENT_RE = /^\s*<!--[\s\S]*?-->\s*/;

export function stripMermaidMetadata(source: string): string {
  return source.replace(LEADING_HTML_COMMENT_RE, "").trim();
}
