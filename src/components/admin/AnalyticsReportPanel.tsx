import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAnalyticsReport } from "@/lib/admin.functions";
import { useLang } from "@/lib/i18n";
import {
  DATE_I18N,
  localizeServerMessage,
} from "@/lib/analytics-report-i18n";

type Report = Awaited<ReturnType<typeof getAnalyticsReport>>;

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(report: Report): string {
  const lines: string[] = [];
  lines.push("Section,Key,Value");
  lines.push(`Meta,Generated at,${csvEscape(report.generatedAt)}`);
  lines.push(`Meta,Survey,${csvEscape(report.surveySlug ?? "All surveys")}`);
  lines.push(`Meta,Date from,${csvEscape(report.dateFrom ?? "—")}`);
  lines.push(`Meta,Date to,${csvEscape(report.dateTo ?? "—")}`);
  lines.push(`Summary,Total responses,${report.total}`);
  lines.push(`Summary,Completed,${report.completed}`);
  lines.push(`Summary,In progress,${report.inProgress}`);
  lines.push(`Summary,Completion rate %,${report.completionRate}`);
  lines.push("");
  lines.push("Language,Count,Percent");
  for (const l of report.byLanguage) {
    lines.push(`${csvEscape(l.language)},${l.count},${l.pct}`);
  }
  if (report.dropOff.length) {
    lines.push("");
    lines.push("Question ID,Section,Question,Answered,Total,Answered %,Drop-off %");
    for (const q of report.dropOff) {
      lines.push(
        [q.id, q.section, q.label, q.answered, q.total, q.answeredPct, q.dropOffPct]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  return lines.join("\r\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPdf(report: Report): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const text = (s: string, size: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(s, pageWidth - margin * 2) as string[];
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };
  const row = (cells: string[], widths: number[], bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    const heights = cells.map((c, i) =>
      (doc.splitTextToSize(c, widths[i] - 6) as string[]).length * 12,
    );
    const rowH = Math.max(...heights, 14);
    ensureSpace(rowH + 4);
    let x = margin;
    cells.forEach((c, i) => {
      const lines = doc.splitTextToSize(c, widths[i] - 6) as string[];
      doc.text(lines, x + 3, y + 10);
      x += widths[i];
    });
    y += rowH;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  };

  text("Analytics report", 18, true);
  text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 10);
  text(`Survey: ${report.surveySlug ?? "All surveys"}`, 10);
  text(
    `Date range: ${report.dateFrom ?? "earliest"} → ${report.dateTo ?? "today"}`,
    10,
  );
  y += 8;

  text("Summary", 14, true);
  row(["Metric", "Value"], [pageWidth - margin * 2 - 120, 120], true);
  row(["Total responses", String(report.total)], [pageWidth - margin * 2 - 120, 120]);
  row(["Completed", String(report.completed)], [pageWidth - margin * 2 - 120, 120]);
  row(["In progress", String(report.inProgress)], [pageWidth - margin * 2 - 120, 120]);
  row(
    ["Completion rate", `${report.completionRate}%`],
    [pageWidth - margin * 2 - 120, 120],
  );
  y += 8;

  text("Language breakdown", 14, true);
  const langW = [180, 120, 120];
  row(["Language", "Count", "Percent"], langW, true);
  if (report.byLanguage.length === 0) {
    text("No data in this range.", 10);
  } else {
    for (const l of report.byLanguage) {
      row([l.language, String(l.count), `${l.pct}%`], langW);
    }
  }
  y += 8;

  text("Drop-off by question", 14, true);
  if (report.dropOff.length === 0) {
    text(
      "Per-question drop-off requires a single survey filter (and at least one response in range).",
      10,
    );
  } else {
    const inner = pageWidth - margin * 2;
    const qW = [inner - 80 - 80 - 80, 80, 80, 80];
    row(["Question", "Answered", "Answered %", "Drop-off %"], qW, true);
    for (const q of report.dropOff) {
      row(
        [
          `${q.label}\n${q.section}`,
          `${q.answered}/${q.total}`,
          `${q.answeredPct}%`,
          `${q.dropOffPct}%`,
        ],
        qW,
      );
    }
  }

  return doc.output("blob");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Coerce free-form input toward `YYYY-MM-DD`:
 * - strip everything that isn't a digit
 * - cap at 8 digits
 * - re-insert hyphens at positions 4 and 6
 *
 * Native `<input type="date">` already enforces this shape, but Safari
 * (and a few mobile browsers) fall back to a plain text field — this
 * keeps the value valid in those cases too.
 */
function maskYmd(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * Pull a `VALIDATION:{...}` payload out of an error message that may have
 * been wrapped by the server-fn transport (e.g. prefixed with
 * "Error: VALIDATION:..." or quoted in a JSON envelope).
 */
function extractValidation(msg: string): string | null {
  const idx = msg.indexOf("VALIDATION:");
  if (idx === -1) return null;
  // Find the JSON object that follows the prefix.
  const start = msg.indexOf("{", idx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < msg.length; i += 1) {
    if (msg[i] === "{") depth += 1;
    else if (msg[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return `VALIDATION:${msg.slice(start, i + 1)}`;
      }
    }
  }
  return null;
}

export function AnalyticsReportPanel({ surveySlug }: { surveySlug?: string }) {
  const fetchReport = useServerFn(getAnalyticsReport);
  const { lang } = useLang();
  const tx = (k: keyof typeof DATE_I18N) => DATE_I18N[k][lang];
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [fromError, setFromError] = useState<string | null>(null);
  const [toError, setToError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  const fileBase = () => {
    const slugPart = surveySlug ?? "all";
    const range =
      dateFrom || dateTo
        ? `_${dateFrom || "start"}_to_${dateTo || todayIso()}`
        : "";
    return `analytics_${slugPart}${range}`;
  };

  const clearErrors = () => {
    setFromError(null);
    setToError(null);
  };

  const validate = (): boolean => {
    clearErrors();
    let ok = true;
    if (dateFrom && !dateTo) {
      setToError(tx("missingTo"));
      ok = false;
    }
    if (!dateFrom && dateTo) {
      setFromError(tx("missingFrom"));
      ok = false;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFromError(tx("inverted"));
      ok = false;
    }
    return ok;
  };

  const applyServerErrors = (msg: string): boolean => {
    if (!msg.startsWith("VALIDATION:")) return false;
    try {
      const payload = JSON.parse(msg.slice("VALIDATION:".length)) as {
        fieldErrors?: Record<string, string>;
      };
      const errs = payload.fieldErrors ?? {};
      clearErrors();
      if (errs.dateFrom) setFromError(localizeServerMessage(errs.dateFrom, lang));
      if (errs.dateTo) setToError(localizeServerMessage(errs.dateTo, lang));
      if (!errs.dateFrom && !errs.dateTo) {
        toast.error("Report failed", { description: msg });
      }
      return true;
    } catch {
      return false;
    }
  };

  const run = async (kind: "csv" | "pdf") => {
    if (!validate()) return;
    setBusy(kind);
    try {
      const report = await fetchReport({
        data: {
          surveySlug,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      if (kind === "csv") {
        const csv = buildCsv(report);
        downloadBlob(
          new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
          `${fileBase()}.csv`,
        );
      } else {
        downloadBlob(buildPdf(report), `${fileBase()}.pdf`);
      }
      toast.success(`${kind.toUpperCase()} — ${tx("downloaded")}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Server validation errors are encoded as `VALIDATION:{json}` so we
      // can surface them next to the offending field. Anything else is an
      // unexpected server error and goes to a toast.
      const handled =
        // Direct prefix from our inputValidator
        applyServerErrors(msg) ||
        // TanStack server-fn sometimes wraps the throw — search anywhere.
        applyServerErrors(extractValidation(msg) ?? "");
      if (!handled) {
        toast.error(tx("failed"), { description: msg });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {tx("intro")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1">
          <Label htmlFor="report-from" className="text-xs">{tx("fromLabel")}</Label>
          <Input
            id="report-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            placeholder={tx("datePlaceholder")}
            pattern="\d{4}-\d{2}-\d{2}"
            inputMode="numeric"
            maxLength={10}
            aria-invalid={fromError ? true : undefined}
            aria-describedby={fromError ? "report-from-error" : undefined}
            onChange={(e) => {
              setDateFrom(maskYmd(e.target.value));
              if (fromError) setFromError(null);
              if (toError) setToError(null);
            }}
          />
          {fromError && (
            <p
              id="report-from-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {fromError}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-to" className="text-xs">{tx("toLabel")}</Label>
          <Input
            id="report-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            max={todayIso()}
          placeholder={tx("datePlaceholder")}
          pattern="\d{4}-\d{2}-\d{2}"
          inputMode="numeric"
          maxLength={10}
          aria-invalid={toError ? true : undefined}
          aria-describedby={toError ? "report-to-error" : undefined}
          onChange={(e) => {
            setDateTo(maskYmd(e.target.value));
            if (toError) setToError(null);
            if (fromError) setFromError(null);
          }}
        />
        {toError && (
          <p
            id="report-to-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {toError}
          </p>
        )}
      </div>
      <p
        id="report-range-help"
        className="col-span-full text-xs text-muted-foreground"
      >
        {tx("rangeHelp")}
      </p>
      <p
        id="report-range-example"
        className="col-span-full text-xs text-muted-foreground"
      >
        {tx("rangeExample")}
      </p>
      <Button
        variant="outline"
        onClick={() => run("csv")}
        disabled={busy !== null}
      >
          {busy === "csv" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          {tx("csvBtn")}
        </Button>
        <Button onClick={() => run("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <FileText className="mr-2 size-4" />
          )}
          {tx("pdfBtn")}
        </Button>
      </div>
    </div>
  );
}
