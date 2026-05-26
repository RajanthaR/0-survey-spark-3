const rawDocs = import.meta.glob<string>(
  ["/docs/**/*.md", "/audits/**/*.md", "/Codex-audits/**/*.md", "/Plans/**/*.md"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

export type DocSearchEntry = {
  path: string;
  title: string;
  headings: string[];
  searchText: string;
};

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function fallbackTitle(path: string): string {
  const filename = normalizeRepoPath(path).split("/").pop() ?? path;
  return filename
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const DOCS = new Map(
  Object.entries(rawDocs).map(([path, source]) => [normalizeRepoPath(path), source] as const),
);

export function loadDoc(repoRelPath: string): string | undefined {
  return DOCS.get(normalizeRepoPath(repoRelPath));
}

export function listDocs(prefix: string): string[] {
  const normalizedPrefix = normalizeRepoPath(prefix);
  return [...DOCS.keys()].filter((path) => path.startsWith(normalizedPrefix)).sort();
}

export function extractMarkdownTitle(source: string | undefined, fallback: string): string {
  if (!source) return fallbackTitle(fallback);
  const titleLine = source.split(/\r?\n/).find((line) => /^#\s+\S/.test(line));
  if (!titleLine) return fallbackTitle(fallback);
  return (
    titleLine
      .replace(/^#\s+/, "")
      .replace(/\s+#*$/, "")
      .trim() || fallbackTitle(fallback)
  );
}

export function extractHeadings(source: string): string[] {
  const headings: string[] = [];
  let inCodeBlock = false;

  for (const line of source.split(/\r?\n/)) {
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push(match[2]);
  }

  return headings;
}

export function buildDocSearchIndex(): DocSearchEntry[] {
  return [...DOCS.entries()]
    .map(([path, source]) => {
      const title = extractMarkdownTitle(source, path);
      const headings = extractHeadings(source);
      return {
        path,
        title,
        headings,
        searchText: [path, title, ...headings].join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
}
