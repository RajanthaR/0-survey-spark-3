export type AuditOrigin = "audits" | "codex-audits";
export type AuditStatus = "done" | "in-progress" | "open";
export type AuditSeverity = "critical" | "high" | "medium" | "low";

export type AuditItem = {
  origin: AuditOrigin;
  id?: string;
  title: string;
  status: AuditStatus;
  severity?: AuditSeverity;
  topic: string;
  sourceFile?: string;
};

const ID_RE = /\b(?:St|DB|[A-Z])-\d+\b/g;

const AUDITS_SOURCE_BY_PREFIX: Record<string, string> = {
  C: "audits/01-content.md",
  U: "audits/02-uiux.md",
  P: "audits/03-performance.md",
  T: "audits/04-testing.md",
  A: "audits/05-architecture.md",
  Q: "audits/06-code-quality.md",
  S: "audits/07-security.md",
  I: "audits/08-i18n.md",
  St: "audits/09-tech-stack.md",
  O: "audits/10-other.md",
  DB: "audits/11-database-deployment.md",
  W: "audits/12-product-admin-workflows.md",
};

const CODEX_SOURCE_BY_PREFIX: Record<string, string> = {
  C: "Codex-audits/01-content-audit.md",
  U: "Codex-audits/02-ui-ux-audit.md",
  P: "Codex-audits/04-performance-audit.md",
  T: "Codex-audits/05-testing-audit.md",
  A: "Codex-audits/06-architecture-audit.md",
  Q: "Codex-audits/07-code-quality-audit.md",
  S: "Codex-audits/08-security-privacy-audit.md",
  I: "Codex-audits/09-multilanguage-i18n-audit.md",
  St: "Codex-audits/10-tech-stack-dependencies-audit.md",
  DB: "Codex-audits/11-database-deployment-audit.md",
  W: "Codex-audits/12-product-admin-workflows-audit.md",
};

const TOPIC_BY_PREFIX: Record<string, string> = {
  C: "content",
  U: "ux",
  P: "performance",
  T: "testing",
  A: "architecture",
  Q: "code quality",
  S: "security",
  I: "i18n",
  St: "dependencies",
  O: "operations",
  DB: "database",
  W: "workflows",
};

const STATUS_ORDER: Record<AuditStatus, number> = {
  open: 0,
  "in-progress": 1,
  done: 2,
};

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function extractIds(value: string): string[] {
  return Array.from(new Set(value.match(ID_RE) ?? []));
}

function prefixForId(id: string | undefined): string | undefined {
  return id?.match(/^(St|DB|[A-Z])-/)?.[1];
}

function sourceFileFor(origin: AuditOrigin, id: string | undefined): string {
  const prefix = prefixForId(id);
  if (!prefix)
    return origin === "audits" ? "audits/99-master-todo.md" : "Codex-audits/MASTER_TODO.md";
  const table = origin === "audits" ? AUDITS_SOURCE_BY_PREFIX : CODEX_SOURCE_BY_PREFIX;
  return (
    table[prefix] ??
    (origin === "audits" ? "audits/99-master-todo.md" : "Codex-audits/MASTER_TODO.md")
  );
}

function topicFor(id: string | undefined, fallback: string): string {
  const prefix = prefixForId(id);
  return (prefix && TOPIC_BY_PREFIX[prefix]) || fallback;
}

function normalizeHeading(line: string): string {
  return line
    .replace(/^#+\s+/, "")
    .replace(/\s+#*$/, "")
    .replace(/^Phase\s+\d+\s*[-:]\s*/i, "")
    .replace(/^P\d+\s*(?:-|\u2014)\s*/i, "")
    .trim()
    .toLowerCase();
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingIds(value: string): string {
  return value.replace(/^(?:(?:St|DB|[A-Z])-\d+\s*(?:\/|,|and)?\s*)+[-:]\s*/i, "").trim();
}

function severityFrom(value: string): AuditSeverity | undefined {
  const match = value.match(/\b(critical|high|medium|low)\b/i);
  return match?.[1]?.toLowerCase() as AuditSeverity | undefined;
}

function statusFromTask(marker: string): AuditStatus {
  if (marker.toLowerCase() === "x") return "done";
  if (marker === "~" || marker === "/") return "in-progress";
  return "open";
}

function parseTableRow(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return undefined;
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  if (cells.length < 4 || cells[0] === "---" || cells[0] === "#") return undefined;
  if (!/^\d+$/.test(cells[0])) return undefined;
  return cells;
}

export function parseMasterTodo(source: string, origin: AuditOrigin): AuditItem[] {
  const items: AuditItem[] = [];
  let currentTopic = origin === "audits" ? "audit backlog" : "audit documentation";

  for (const line of source.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      currentTopic = normalizeHeading(heading[1]);
      continue;
    }

    if (origin === "codex-audits") {
      const task = /^\s*-\s+\[([ xX~/])\]\s+(.+?)\s*$/.exec(line);
      if (!task) continue;
      const rawTitle = cleanMarkdown(task[2]);
      const ids = extractIds(rawTitle);
      const firstId = ids[0];
      items.push({
        origin,
        id: ids.length ? ids.join(" / ") : undefined,
        title: stripLeadingIds(rawTitle),
        status: statusFromTask(task[1]),
        severity: severityFrom(rawTitle),
        topic: topicFor(firstId, currentTopic),
        sourceFile: sourceFileFor(origin, firstId),
      });
      continue;
    }

    const cells = parseTableRow(line);
    if (!cells) continue;
    const idText = cleanMarkdown(cells[1]);
    const ids = extractIds(idText);
    const firstId = ids[0];
    const titleText = cleanMarkdown(cells[2]);
    const whyText = cleanMarkdown(cells[4] ?? "");
    items.push({
      origin,
      id: ids.length ? ids.join(" / ") : undefined,
      title: titleText,
      status: "open",
      severity: severityFrom(`${titleText} ${whyText}`),
      topic: topicFor(firstId, currentTopic),
      sourceFile: sourceFileFor(origin, firstId),
    });
  }

  return items;
}

// Severity is critical=0..low=3. Items without a severity sort AFTER all known
// severities, so use a finite sentinel rather than Infinity — `Infinity - Infinity`
// is NaN and would violate the Array.prototype.sort comparator contract.
const SEVERITY_UNKNOWN = 4;

export function sortAuditItems(items: AuditItem[]): AuditItem[] {
  return [...items].sort((a, b) => {
    const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDelta) return statusDelta;
    const aSev = a.severity ? SEVERITY_ORDER[a.severity] : SEVERITY_UNKNOWN;
    const bSev = b.severity ? SEVERITY_ORDER[b.severity] : SEVERITY_UNKNOWN;
    const severityDelta = aSev - bSev;
    if (severityDelta) return severityDelta;
    return (a.id ?? a.title).localeCompare(b.id ?? b.title);
  });
}
