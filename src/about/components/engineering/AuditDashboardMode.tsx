import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  parseMasterTodo,
  sortAuditItems,
  type AuditItem,
  type AuditOrigin,
  type AuditSeverity,
  type AuditStatus,
} from "@/about/lib/audit-parser";
import { loadDoc } from "@/about/lib/load-doc";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ORIGIN_LABEL: Record<AuditOrigin, string> = {
  audits: "audits/",
  "codex-audits": "Codex-audits/",
};

const STATUS_LABEL: Record<AuditStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  open: "Open",
};

const TOPIC_ORDER = [
  "content",
  "ux",
  "a11y",
  "performance",
  "testing",
  "architecture",
  "code quality",
  "security",
  "i18n",
  "dependencies",
  "database",
  "workflows",
  "operations",
];

function badgeVariantForSeverity(severity: AuditSeverity | undefined) {
  if (severity === "critical" || severity === "high") return "destructive" as const;
  if (severity === "medium") return "secondary" as const;
  return "outline" as const;
}

function badgeVariantForStatus(status: AuditStatus) {
  if (status === "done") return "secondary" as const;
  if (status === "in-progress") return "outline" as const;
  return "default" as const;
}

function itemsByTopic(items: AuditItem[]): Array<[string, AuditItem[]]> {
  const grouped = new Map<string, AuditItem[]>();
  for (const item of items) {
    const key = item.topic || "uncategorized";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.entries()].sort(([a], [b]) => {
    const aIndex = TOPIC_ORDER.indexOf(a);
    const bIndex = TOPIC_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (
        (aIndex === -1 ? Number.POSITIVE_INFINITY : aIndex) -
        (bIndex === -1 ? Number.POSITIVE_INFINITY : bIndex)
      );
    }
    return a.localeCompare(b);
  });
}

function originStats(items: AuditItem[], origin: AuditOrigin) {
  const scoped = items.filter((item) => item.origin === origin);
  const done = scoped.filter((item) => item.status === "done").length;
  const inProgress = scoped.filter((item) => item.status === "in-progress").length;
  const open = scoped.filter((item) => item.status === "open").length;
  return {
    origin,
    total: scoped.length,
    done,
    inProgress,
    open,
    donePct: scoped.length ? Math.round((done / scoped.length) * 100) : 0,
  };
}

function AuditScoreboard({ items }: { items: AuditItem[] }) {
  const stats = [originStats(items, "audits"), originStats(items, "codex-audits")];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.origin} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{ORIGIN_LABEL[stat.origin]}</h2>
            <Badge variant="outline">{stat.donePct}% done</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-xl font-semibold">{stat.total}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Done</dt>
              <dd className="text-xl font-semibold">{stat.done}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Open</dt>
              <dd className="text-xl font-semibold">{stat.open}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active</dt>
              <dd className="text-xl font-semibold">{stat.inProgress}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

function SourceLink({ item }: { item: AuditItem }) {
  if (!item.sourceFile) return <span className="text-muted-foreground">-</span>;
  return (
    <Link
      to="/about/engineering"
      search={{ mode: "browser", doc: item.sourceFile }}
      className="text-primary underline-offset-4 hover:underline"
    >
      {item.sourceFile}
    </Link>
  );
}

function AuditTable({ topic, items }: { topic: string; items: AuditItem[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold capitalize">{topic}</h2>
        <Badge variant="outline">{items.length} items</Badge>
      </div>
      <ScrollArea className="w-full max-w-full rounded-md border">
        <div className="min-w-[48rem]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8rem]">Status</TableHead>
                <TableHead className="w-[8rem]">Severity</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-[16rem]">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.origin}-${item.id ?? item.title}-${index}`}>
                  <TableCell>
                    <Badge variant={badgeVariantForStatus(item.status)}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariantForSeverity(item.severity)}>
                      {item.severity ?? "not tagged"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {[ORIGIN_LABEL[item.origin], item.id].filter(Boolean).join(" - ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <SourceLink item={item} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

export default function AuditDashboardMode() {
  const items = useMemo(() => {
    const audits = loadDoc("audits/99-master-todo.md") ?? "";
    const codexAudits = loadDoc("Codex-audits/MASTER_TODO.md") ?? "";
    return sortAuditItems([
      ...parseMasterTodo(audits, "audits"),
      ...parseMasterTodo(codexAudits, "codex-audits"),
    ]);
  }, []);
  const grouped = itemsByTopic(items);

  return (
    <article className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Audit status
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Engineering Audit Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Parsed from `audits/99-master-todo.md` and `Codex-audits/MASTER_TODO.md`.
        </p>
      </div>
      <AuditScoreboard items={items} />
      <Separator />
      <div className="flex flex-col gap-8">
        {grouped.map(([topic, topicItems]) => (
          <AuditTable key={topic} topic={topic} items={topicItems} />
        ))}
      </div>
    </article>
  );
}
