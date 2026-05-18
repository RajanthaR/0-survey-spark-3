import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Download, LogOut, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizeCsvChunk, validateAssembledCsv } from "@/lib/csv-continuity";
import { CRC32_INIT, crc32Update, crc32Hex, crc32OfBytes, sha256Hex, utf8 } from "@/lib/checksum";
import { buildLogUrl, getLogUrlTemplate, setLogUrlTemplate, openLogUrl } from "@/lib/log-link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  exportCsv,
  exportCodebookCsv,
  exportCodebookXlsx,
  exportFilteredCsv,
  exportFilteredXlsx,
  exportZipBundle,
  getStats,
  listResponses,
  previewFilteredCount,
  streamAllValidCsv,
  streamAllValidXlsx,
} from "@/lib/admin.functions";
import { Zip, AsyncZipDeflate, strToU8 } from "fflate";
import { SURVEY_LIST, SURVEYS } from "@/surveys";
import { buildCodebookHeaders, type CodebookLang } from "@/lib/csv-export-shape";
import { LANG_LABELS, pickText, useLang } from "@/lib/i18n";
import {
  AllValidProgressCard,
  type AllValidProgress,
} from "@/components/admin/AllValidProgressCard";
import { CopyRequestIdButton } from "@/components/admin/CopyRequestIdButton";
import {
  ZipBundleProgressCard,
  type ZipBundleProgress,
} from "@/components/admin/ZipBundleProgressCard";
import { LiveStatusPill } from "@/components/admin/LiveStatusPill";
import { AnalyticsReportPanel } from "@/components/admin/AnalyticsReportPanel";
import {
  FilteredBySurveyChips,
  FilteredSampleTable,
  FilteredDailyChart,
  FilteredByStatusChips,
  type FilteredPreview,
} from "@/components/admin/FilteredPreviewExtras";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Extracted in D19: lazy charts bundle, presentation primitives, and the
// auth login panel each live in their own module under src/routes/admin/.
import { DashboardCharts } from "@/routes/admin/-charts-lazy";
import { Card, ChartFallback, Stat } from "@/routes/admin/-primitives";
import {
  LineChartSkeleton,
  BarChartSkeleton,
  PieChartSkeleton,
  HBarListSkeleton,
  StackedBarSkeleton,
} from "@/components/admin/ChartSkeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QuestionDropoffDrilldown,
  type QuestionDrilldownData,
} from "@/components/admin/QuestionDropoffDrilldown";
import { computeDropoff } from "@/lib/admin/dropoff";
import { AlertsPanel } from "@/components/admin/AlertsPanel";
import { detectAlerts, type AdminAlert, type AlertSnapshot } from "@/lib/admin/alerts";

type StatsResult = Awaited<ReturnType<typeof getStats>>;
type ListResult = Awaited<ReturnType<typeof listResponses>>;

const PAGE_SIZE = 25;

export function AdminDashboard({ email }: { email: string; activeSection?: string }) {
  const { lang } = useLang();
  const statsFn = useServerFn(getStats);
  const listFn = useServerFn(listResponses);
  const exportFn = useServerFn(exportCsv);
  const exportCodebookFn = useServerFn(exportCodebookCsv);
  const exportCodebookXlsxFn = useServerFn(exportCodebookXlsx);
  const exportFilteredFn = useServerFn(exportFilteredCsv);
  const exportFilteredXlsxFn = useServerFn(exportFilteredXlsx);
  const previewFilteredFn = useServerFn(previewFilteredCount);
  const streamAllFn = useServerFn(streamAllValidCsv);
  const streamAllXlsxFn = useServerFn(streamAllValidXlsx);
  const exportZipFn = useServerFn(exportZipBundle);

  const [slug, setSlug] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  // ── Cohort filters (D24) ────────────────────────────────────────────
  // Drive the top-of-dashboard stats + response list by language and
  // started_at date range so admins can compare response quality across
  // cohorts (e.g. EN vs SI in March, phase-1 vs phase-3 last week).
  // Persisted to localStorage so the chosen cohort sticks across reloads.
  const COHORT_PREFS_KEY = "eip-insight:admin:cohort:v1";
  type CohortPrefs = { lang: string; from: string; to: string };
  const cohortPersisted: CohortPrefs = (() => {
    if (typeof window === "undefined") return { lang: "__all__", from: "", to: "" };
    try {
      const raw = window.localStorage.getItem(COHORT_PREFS_KEY);
      return raw ? (JSON.parse(raw) as CohortPrefs) : { lang: "__all__", from: "", to: "" };
    } catch {
      return { lang: "__all__", from: "", to: "" };
    }
  })();
  const [cohortLang, setCohortLang] = useState<string>(cohortPersisted.lang ?? "__all__");
  const [cohortFrom, setCohortFrom] = useState<string>(cohortPersisted.from ?? "");
  const [cohortTo, setCohortTo] = useState<string>(cohortPersisted.to ?? "");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        COHORT_PREFS_KEY,
        JSON.stringify({ lang: cohortLang, from: cohortFrom, to: cohortTo }),
      );
    } catch {
      /* ignore */
    }
  }, [cohortLang, cohortFrom, cohortTo]);
  const cohortDatesValid = !(cohortFrom && cohortTo && cohortFrom > cohortTo);
  // Currently-open question in the drop-off drilldown dialog. `null` =
  // closed. Resets when the survey scope changes so a stale id from
  // another survey can never resolve a misleading drilldown.
  const [dropoffSelectedId, setDropoffSelectedId] = useState<string | null>(null);
  useEffect(() => {
    setDropoffSelectedId(null);
  }, [slug]);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [list, setList] = useState<ListResult | null>(null);
  // Live admin alerts — completion drops + per-question skip spikes.
  // `prevSnapshotRef` holds the last snapshot so the detector can diff
  // each refresh without re-running on unrelated re-renders.
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const prevSnapshotRef = useRef<AlertSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [allValidProgress, setAllValidProgress] = useState<AllValidProgress | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipBundleProgress | null>(null);
  // Cancel flag for the streaming all-valid CSV export. A ref so the
  // for-await loop can read the latest value without re-rendering, plus
  // a state mirror so the Cancel button can flip to "Cancelling…".
  const allValidCancelRef = useRef(false);
  const [allValidCancelling, setAllValidCancelling] = useState(false);
  // AbortController for the streaming request itself — wired into
  // `streamAllFn({ signal })` so confirming the cancel dialog actively
  // tears down the underlying ReadableStream (server stops paginating
  // within at most one in-flight page) instead of just breaking out of
  // the for-await on the next event.
  const allValidAbortRef = useRef<AbortController | null>(null);
  // Confirmation dialog gate for cancelling the all-valid export — the
  // run can take minutes on large datasets so we don't want a misclick
  // on "Cancel" to discard the work-in-progress silently.
  const [confirmCancelAllValidOpen, setConfirmCancelAllValidOpen] = useState(false);
  // AbortController for the (single-shot) filtered CSV / XLSX exports.
  // Lets the admin stop a long-running filtered export the same way
  // they can stop the all-valid stream.
  const filteredAbortRef = useRef<AbortController | null>(null);
  const [filteredCancelling, setFilteredCancelling] = useState(false);
  // Throughput tracking for ETA. `startedAt` anchors the run, `lastSample`
  // holds the previous (timestamp, processed) sample so we can derive an
  // instantaneous rate per chunk and fold it into an EWMA for stability.
  // `bytesProcessed` accumulates streamed CSV bytes so the card can show
  // an estimated remaining file size; `rateHistory` keeps the recent
  // rows/sec samples that feed the inline sparkline.
  const allValidRateRef = useRef<{
    startedAt: number;
    lastSampleAt: number;
    lastProcessed: number;
    smoothedRate: number;
    bytesProcessed: number;
    rateHistory: number[];
  } | null>(null);
  // Pause gate for the streaming run. While paused, the for-await loop
  // awaits `pauseGateRef.current.promise` before consuming the next
  // chunk — that backpressures the underlying ReadableStream so the
  // server stops paginating until the admin clicks Resume.
  function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
    return Math.max(lo, Math.min(hi, n));
  }
  function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.max(lo, Math.min(hi, n));
  }
  type PauseGate = { promise: Promise<void>; resolve: () => void };
  const pauseGateRef = useRef<PauseGate | null>(null);
  const [allValidPaused, setAllValidPaused] = useState(false);
  const RATE_HISTORY_CAP = 30;

  // Resume / partial-download / correlation state for the streaming
  // export. The buffer survives across retry attempts so "Resume from
  // last page" can append new chunks to the prior CSV body and
  // "Download partial" can save whatever was streamed before failure.
  type PartialBuffer = {
    filename: string;
    total: number;
    pageSize: number;
    requestId: string;
    /** CSV body chunks (header line + each chunk's csv). BOM is added at blob time. */
    chunks: string[];
    rowCount: number;
    /** Last page index successfully appended; -1 before any chunk lands. */
    lastPage: number;
  };
  const partialBufferRef = useRef<PartialBuffer | null>(null);
  const [failedRun, setFailedRun] = useState<{
    error: string;
    requestId: string;
    rowCount: number;
    lastPage: number;
    canResume: boolean;
  } | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  // Mirror of currentRequestId for the XLSX pipeline so the inline
  // progress strip can render the run's requestId continuously across
  // restored / resuming / fetching / finalizing / cancelled phases.
  const [xlsxCurrentRequestId, setXlsxCurrentRequestId] = useState<string | null>(null);

  // Configurable retry/backoff knobs persisted to localStorage so the
  // admin's reliability/speed tradeoff sticks across reloads.
  const RETRY_PREFS_KEY = "eip-insight:admin:streamRetry:v1";
  type RetryPrefs = { maxAttempts: number; baseDelayMs: number; backoffFactor: number };
  const DEFAULT_RETRY: RetryPrefs = { maxAttempts: 3, baseDelayMs: 300, backoffFactor: 3 };
  const [retryPrefs, setRetryPrefs] = useState<RetryPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_RETRY;
    try {
      const raw = window.localStorage.getItem(RETRY_PREFS_KEY);
      if (!raw) return DEFAULT_RETRY;
      const p = JSON.parse(raw) as Partial<RetryPrefs>;
      return {
        maxAttempts: clampInt(p.maxAttempts, 1, 10, DEFAULT_RETRY.maxAttempts),
        baseDelayMs: clampInt(p.baseDelayMs, 0, 60_000, DEFAULT_RETRY.baseDelayMs),
        backoffFactor: clampNum(p.backoffFactor, 1, 10, DEFAULT_RETRY.backoffFactor),
      };
    } catch {
      return DEFAULT_RETRY;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RETRY_PREFS_KEY, JSON.stringify(retryPrefs));
    } catch {
      /* ignore quota */
    }
  }, [retryPrefs]);

  // ── Persistent failed-run resume buffers ───────────────────────────
  // Persist the partial buffer + failed-run banner in localStorage so a
  // transient stream failure can be resumed even after a full page
  // refresh. Keys are versioned so a future shape change can ignore old
  // payloads instead of crashing on hydrate.
  //
  // localStorage is shared across the origin and most browsers cap it at
  // ~5 MB total. A large XLSX run can blow past that, so we (a) refuse to
  // persist payloads above RESUME_PERSIST_LIMIT_BYTES, (b) catch any
  // QuotaExceededError from setItem as a fallback, and (c) surface a
  // single toast per kind so the admin knows the on-disk resume is gone
  // (in-memory resume in the current tab still works).
  const CSV_RESUME_KEY = "eip-insight:admin:resumeBuffer:csv:v1";
  const XLSX_RESUME_KEY = "eip-insight:admin:resumeBuffer:xlsx:v1";
  // Standalone persistence for the *current* XLSX run's requestId so a
  // page refresh mid-stream (before any failure has been captured) can
  // still surface the in-flight requestId in the resume toast/banner.
  // The failedRun payload also carries a requestId, but it's only
  // written once a stream error is caught — this key is updated on
  // every meta event and on resume start, then cleared on success/
  // dismiss/cancel. Acts as a fallback when the persisted failedRun
  // is missing or its requestId is "unknown".
  const XLSX_CURRENT_REQUEST_ID_KEY = "eip-insight:admin:xlsxCurrentRequestId:v1";
  // Mirror the in-memory `xlsxCurrentRequestId` to localStorage so a
  // refresh during an active stream still has the requestId available
  // for the resume toast / banner on next mount. Cleared when the
  // state is null (success / dismiss / cancel).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (xlsxCurrentRequestId) {
        window.localStorage.setItem(XLSX_CURRENT_REQUEST_ID_KEY, xlsxCurrentRequestId);
      } else {
        window.localStorage.removeItem(XLSX_CURRENT_REQUEST_ID_KEY);
      }
    } catch {
      /* quota / disabled storage — fall back to in-memory only */
    }
  }, [xlsxCurrentRequestId, XLSX_CURRENT_REQUEST_ID_KEY]);
  // 4 MB — conservative ceiling well below the typical 5 MB origin quota
  // shared with filters, retry prefs, codebook prefs, etc.
  const RESUME_PERSIST_LIMIT_BYTES = 4 * 1024 * 1024;
  // Dedupe the warning toast per (kind, reason) so a streaming export that
  // ticks every chunk doesn't spam dozens of identical warnings.
  const persistWarnedRef = useRef<Set<string>>(new Set());
  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };
  const warnPersistOnce = (
    kind: "csv" | "xlsx",
    reason: "limit" | "quota",
    sizeBytes: number,
    requestId: string,
  ) => {
    const key = `${kind}:${reason}`;
    if (persistWarnedRef.current.has(key)) return;
    persistWarnedRef.current.add(key);
    const label = kind === "csv" ? "CSV" : "XLSX";
    const size = formatBytes(sizeBytes);
    const limit = formatBytes(RESUME_PERSIST_LIMIT_BYTES);
    const detail =
      reason === "limit"
        ? `${label} resume buffer is ${size} (over the ${limit} safe limit). It won't be saved across refreshes — finish the run in this tab.`
        : `Browser storage rejected the ${label} resume buffer (${size}). It won't be saved across refreshes — finish the run in this tab.`;
    toast.warning(`Resume data too large to persist (req ${requestId})`, {
      description: detail,
      duration: 10_000,
    });
  };
  const clearPersistWarning = (kind: "csv" | "xlsx") => {
    persistWarnedRef.current.delete(`${kind}:limit`);
    persistWarnedRef.current.delete(`${kind}:quota`);
  };
  type PersistedFailedRun = {
    error: string;
    requestId: string;
    rowCount: number;
    lastPage: number;
  };
  const tryPersist = (
    kind: "csv" | "xlsx",
    storageKey: string,
    payload: unknown,
    requestId: string,
  ) => {
    if (typeof window === "undefined") return;
    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      return; // unserializable — in-memory resume still works
    }
    // String length is a close-enough proxy for UTF-16 byte cost in
    // localStorage; multiply by 2 for the worst-case storage estimate.
    const sizeBytes = serialized.length * 2;
    if (sizeBytes > RESUME_PERSIST_LIMIT_BYTES) {
      warnPersistOnce(kind, "limit", sizeBytes, requestId);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      window.localStorage.setItem(storageKey, serialized);
      // Successful write — allow a fresh warning if the payload grows past
      // the limit later in the same run.
      clearPersistWarning(kind);
    } catch {
      warnPersistOnce(kind, "quota", sizeBytes, requestId);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  };
  const saveCsvResume = (buf: PartialBuffer, fr: PersistedFailedRun) => {
    tryPersist(
      "csv",
      CSV_RESUME_KEY,
      { buffer: buf, failedRun: fr, savedAt: Date.now() },
      fr.requestId,
    );
  };
  const clearCsvResume = () => {
    if (typeof window === "undefined") return;
    clearPersistWarning("csv");
    try {
      window.localStorage.removeItem(CSV_RESUME_KEY);
    } catch {
      /* ignore */
    }
  };
  const saveXlsxResume = (buf: XlsxPartialBuffer, fr: PersistedFailedRun) => {
    tryPersist(
      "xlsx",
      XLSX_RESUME_KEY,
      { buffer: buf, failedRun: fr, savedAt: Date.now() },
      fr.requestId,
    );
  };
  const clearXlsxResume = () => {
    if (typeof window === "undefined") return;
    clearPersistWarning("xlsx");
    try {
      window.localStorage.removeItem(XLSX_RESUME_KEY);
    } catch {
      /* ignore */
    }
  };

  // ── Streaming all-valid XLSX export state ──────────────────────────
  // Mirrors the CSV streaming flow but buffers raw row arrays (the
  // workbook is assembled on `done`). Resume reuses the buffered rows
  // and continues from `lastPage + 1` so the final .xlsx contains every
  // row exactly once even after a transient mid-stream failure.
  type XlsxAllValidProgress = {
    processed: number;
    total: number;
    phase: "starting" | "restored" | "resuming" | "fetching" | "finalizing" | "cancelled";
    /** When triggered via "Resume from last page", the page number the
     *  new stream starts from (i.e. `lastPage + 1`). Surfaces in the
     *  inline progress strip so admins can see the run picked up where
     *  it left off rather than restarting from page 1. */
    resumeFromPage?: number;
  };
  const [xlsxAllValidProgress, setXlsxAllValidProgress] = useState<XlsxAllValidProgress | null>(
    null,
  );
  type XlsxPartialBuffer = {
    filename: string;
    total: number;
    pageSize: number;
    requestId: string;
    headerRow: string[];
    rows: (string | number | boolean | null)[][];
    rowCount: number;
    lastPage: number;
  };
  const xlsxPartialBufferRef = useRef<XlsxPartialBuffer | null>(null);
  const [xlsxFailedRun, setXlsxFailedRun] = useState<{
    error: string;
    requestId: string;
    rowCount: number;
    lastPage: number;
    canResume: boolean;
    /** Set when the streamer threw `<label> failed after N attempts …`,
     *  meaning every retry was used up. The banner switches to a more
     *  prominent "Retries exhausted" panel with the parsed inner error
     *  and a one-click "Increase retries & resume" action. */
    exhausted?: {
      attempts: number;
      lastErrorMessage: string;
      backoff: { maxAttempts: number; baseDelayMs: number; backoffFactor: number };
    };
  } | null>(null);
  const xlsxAbortRef = useRef<AbortController | null>(null);

  // Configurable "View logs" URL template — substitutes {requestId} (or
  // {id}) and opens in a new tab. Persisted in localStorage so each
  // browser/admin can point at their own logging system.
  const [logUrlTemplate, setLogUrlTemplateState] = useState<string>(() => getLogUrlTemplate());
  const [logUrlDraft, setLogUrlDraft] = useState<string>(() => getLogUrlTemplate());
  const persistLogUrlTemplate = (next: string) => {
    setLogUrlTemplate(next);
    setLogUrlTemplateState(next.trim());
    setLogUrlDraft(next.trim());
  };
  // Build a sonner action descriptor for "View logs" — returns undefined
  // when the template is unset or the requestId is unknown so the toast
  // simply omits the action button.
  const viewLogsAction = (requestId: string | null | undefined) =>
    buildLogUrl(requestId, logUrlTemplate)
      ? { label: "View logs", onClick: () => openLogUrl(requestId) }
      : undefined;

  // Set by the hydration effect when a persisted failed run is restored
  // from localStorage after a page refresh. Drives the auto-resume
  // prompt (AlertDialog) so the admin sees the saved lastPage +
  // requestId immediately without having to scroll to the banner.
  type ResumePromptEntry = {
    kind: "csv" | "xlsx";
    requestId: string;
    lastPage: number;
    rowCount: number;
    error: string;
  };
  const [resumePrompts, setResumePrompts] = useState<ResumePromptEntry[]>([]);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  // Hydrate persisted resume buffers (CSV + XLSX) on mount so a page
  // refresh after a transient stream failure still surfaces the
  // "Resume from last page" banner. Stale or corrupt payloads are
  // dropped silently — the worst case is the admin re-runs the export.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const restored: ResumePromptEntry[] = [];
    try {
      const raw = window.localStorage.getItem(CSV_RESUME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          buffer?: PartialBuffer;
          failedRun?: PersistedFailedRun;
        };
        const b = parsed.buffer;
        const fr = parsed.failedRun;
        if (
          b &&
          Array.isArray(b.chunks) &&
          typeof b.lastPage === "number" &&
          b.lastPage >= 0 &&
          fr &&
          typeof fr.error === "string"
        ) {
          partialBufferRef.current = {
            filename: b.filename,
            total: b.total,
            pageSize: b.pageSize,
            requestId: b.requestId,
            chunks: [...b.chunks],
            rowCount: b.rowCount,
            lastPage: b.lastPage,
          };
          setFailedRun({
            error: fr.error,
            requestId: fr.requestId,
            rowCount: fr.rowCount,
            lastPage: fr.lastPage,
            canResume: true,
          });
          setCurrentRequestId(fr.requestId || null);
          // Surface a "Restored from refresh" snapshot in the progress
          // card so the admin sees the rehydrated buffer (rows + the
          // page a resume would continue from) immediately on mount —
          // not just the failed-run banner. Rate/ETA stay zeroed; the
          // card's `phase: "restored"` branch suppresses the live
          // sampler row and shows skeletons until Resume kicks off the
          // new run, at which point the existing resume flow flips to
          // `phase: "resuming"` and recomputes everything from scratch.
          setAllValidProgress({
            processed: fr.rowCount,
            total: typeof b.total === "number" ? b.total : 0,
            phase: "restored",
            rate: 0,
            etaSeconds: null,
            bytesProcessed: 0,
            rateHistory: [],
            resumeFromPage: fr.lastPage + 1,
          });
          restored.push({
            kind: "csv",
            requestId: fr.requestId,
            lastPage: fr.lastPage,
            rowCount: fr.rowCount,
            error: fr.error,
          });
        } else {
          clearCsvResume();
        }
      }
    } catch {
      clearCsvResume();
    }
    // Read the standalone XLSX current-requestId fallback once. Used
    // when the persisted failedRun is absent or its requestId is
    // missing/"unknown" (e.g. refresh during an active stream before
    // any error was caught).
    let xlsxCurrentRequestIdFallback: string | null = null;
    try {
      const cid = window.localStorage.getItem(XLSX_CURRENT_REQUEST_ID_KEY);
      if (cid && cid !== "unknown") xlsxCurrentRequestIdFallback = cid;
    } catch {
      xlsxCurrentRequestIdFallback = null;
    }
    try {
      const raw = window.localStorage.getItem(XLSX_RESUME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          buffer?: XlsxPartialBuffer;
          failedRun?: PersistedFailedRun;
        };
        const b = parsed.buffer;
        const fr = parsed.failedRun;
        if (
          b &&
          Array.isArray(b.rows) &&
          Array.isArray(b.headerRow) &&
          typeof b.lastPage === "number" &&
          b.lastPage >= 0 &&
          fr &&
          typeof fr.error === "string"
        ) {
          // Prefer the persisted failedRun.requestId, but fall back to
          // the standalone current-requestId key when it's missing or
          // "unknown" so the resume toast/banner still shows a
          // correlatable id after a refresh.
          const effectiveRequestId =
            fr.requestId && fr.requestId !== "unknown"
              ? fr.requestId
              : (xlsxCurrentRequestIdFallback ?? fr.requestId);
          xlsxPartialBufferRef.current = {
            filename: b.filename,
            total: b.total,
            pageSize: b.pageSize,
            requestId: b.requestId,
            headerRow: [...b.headerRow],
            rows: [...b.rows],
            rowCount: b.rowCount,
            lastPage: b.lastPage,
          };
          setXlsxFailedRun({
            error: fr.error,
            requestId: effectiveRequestId,
            rowCount: fr.rowCount,
            lastPage: fr.lastPage,
            canResume: true,
          });
          setXlsxCurrentRequestId(effectiveRequestId || null);
          // Mirror the CSV side: surface a "Restored from refresh"
          // snapshot in the inline XLSX progress strip on mount so the
          // admin can see the rehydrated row count + the page a resume
          // would continue from before clicking Resume.
          setXlsxAllValidProgress({
            processed: fr.rowCount,
            total: typeof b.total === "number" ? b.total : 0,
            phase: "restored",
            resumeFromPage: fr.lastPage + 1,
          });
          restored.push({
            kind: "xlsx",
            requestId: effectiveRequestId,
            lastPage: fr.lastPage,
            rowCount: fr.rowCount,
            error: fr.error,
          });
        } else {
          clearXlsxResume();
        }
      } else if (xlsxCurrentRequestIdFallback) {
        // No persisted failedRun, but a current-requestId is on disk
        // from an in-flight stream that was interrupted by refresh.
        // Restore it into in-memory state so the inline progress badge
        // (and any subsequent toast/banner) can display it without
        // waiting for a fresh meta event.
        setXlsxCurrentRequestId(xlsxCurrentRequestIdFallback);
      }
    } catch {
      clearXlsxResume();
    }
    if (restored.length > 0) {
      setResumePrompts(restored);
      setResumePromptOpen(true);
    }
    // Hydration runs once on mount — keys/helpers are stable for the
    // life of the component so no dependency churn is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered-export controls (independent of the dashboard scope tabs).
  // Persisted in localStorage so the admin's last-used filters survive reloads.
  const FILTERS_STORAGE_KEY = "admin.filteredExport.filters.v1";
  type StatusFilter = "completed" | "in_progress" | "all";
  type PersistedFilters = {
    fSurvey: string;
    fLang: string;
    fFrom: string;
    fTo: string;
    /** Legacy field — superseded by `fStatus`, still read for backward compat. */
    fCompletedOnly?: boolean;
    fStatus: StatusFilter;
    fValidOnly: boolean;
    fDateField: "started_at" | "completed_at";
  };
  const loadPersistedFilters = (): Partial<PersistedFilters> => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };
  const persisted = loadPersistedFilters();
  const [fSurvey, setFSurvey] = useState<string>(persisted.fSurvey ?? "__all__");
  const [fLang, setFLang] = useState<string>(persisted.fLang ?? "__all__");
  const [fFrom, setFFrom] = useState<string>(persisted.fFrom ?? "");
  const [fTo, setFTo] = useState<string>(persisted.fTo ?? "");
  const [fStatus, setFStatus] = useState<StatusFilter>(() => {
    if (
      persisted.fStatus === "completed" ||
      persisted.fStatus === "in_progress" ||
      persisted.fStatus === "all"
    ) {
      return persisted.fStatus;
    }
    // Migrate from legacy `fCompletedOnly` boolean.
    if (typeof persisted.fCompletedOnly === "boolean") {
      return persisted.fCompletedOnly ? "completed" : "all";
    }
    return "completed";
  });
  const [fValidOnly, setFValidOnly] = useState<boolean>(
    typeof persisted.fValidOnly === "boolean" ? persisted.fValidOnly : false,
  );
  const [fDateField, setFDateField] = useState<"started_at" | "completed_at">(
    persisted.fDateField === "completed_at" ? "completed_at" : "started_at",
  );

  // `validOnly` requires `completed`. Surface that to the UI as well.
  const effectiveStatus: StatusFilter = fValidOnly ? "completed" : fStatus;

  // Persist filter changes to localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          fSurvey,
          fLang,
          fFrom,
          fTo,
          fStatus,
          fValidOnly,
          fDateField,
        } satisfies PersistedFilters),
      );
    } catch {
      // Ignore quota / disabled storage errors — filters still work in-session.
    }
  }, [fSurvey, fLang, fFrom, fTo, fStatus, fValidOnly, fDateField]);

  // Live preview of the filtered-export row count + per-survey breakdown
  // + sample rows + daily timeseries. All four are folded into a single
  // debounced server-fn call so adding the breakdowns costs zero extra
  // round-trips when the user is fiddling with filter inputs.
  const [preview, setPreview] = useState<FilteredPreview | null>(null);
  // Confirmation dialog gate for the filtered CSV export. Opens with
  // the current preview snapshot so the dialog summarizes matched +
  // dropped-invalid + dropped-unknown counts before the user commits.
  const [confirmCsvOpen, setConfirmCsvOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const datesValid = !(fFrom && fTo && fFrom > fTo);

  useEffect(() => {
    if (!datesValid) {
      setPreview(null);
      setPreviewError("Start date must be on or before end date.");
      setPreviewLoading(false);
      return;
    }
    setPreviewError(null);
    setPreviewLoading(true);
    const handle = setTimeout(() => {
      const payload: Parameters<typeof previewFilteredFn>[0]["data"] = {
        statusFilter: effectiveStatus,
        validOnly: fValidOnly,
        dateField: fDateField,
      };
      if (fSurvey !== "__all__") payload.surveySlug = fSurvey;
      if (fLang !== "__all__") payload.language = fLang as "en" | "si" | "ta";
      if (fFrom) payload.dateFrom = fFrom;
      if (fTo) payload.dateTo = fTo;
      let cancelled = false;
      previewFilteredFn({ data: payload })
        .then((r) => {
          if (cancelled) return;
          setPreview({
            matched: r.matched,
            totalFetched: r.totalFetched ?? r.matched,
            droppedInvalid: r.droppedInvalid ?? 0,
            droppedUnknownSurvey: r.droppedUnknownSurvey ?? 0,
            bySurvey: r.bySurvey ?? [],
            byStatus: r.byStatus ?? { completed: 0, in_progress: 0, other: 0 },
            byDay: r.byDay ?? [],
            sample: r.sample ?? [],
            breakdownTruncated: r.breakdownTruncated ?? false,
            timeseriesAvailable: r.timeseriesAvailable ?? false,
          });
        })
        .catch((e) => {
          if (cancelled) return;
          setPreviewError((e as Error).message);
          setPreview(null);
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 300);
    return () => clearTimeout(handle);
  }, [
    fSurvey,
    fLang,
    fFrom,
    fTo,
    effectiveStatus,
    fValidOnly,
    fDateField,
    datesValid,
    previewFilteredFn,
  ]);

  // Apply the filter-panel Status (Completed / In progress / All) to the
  // top-of-page analytics + stats so the dashboard cards, daily chart,
  // language/survey splits, and per-question stats describe the same
  // slice the export will produce. Survey-scope tabs continue to scope
  // by `slug` independently.
  const statsParams = useMemo(
    () => ({
      ...(slug === "__all__" ? {} : { surveySlug: slug }),
      ...(effectiveStatus === "all" ? {} : { statusFilter: effectiveStatus }),
      ...(cohortLang === "__all__" ? {} : { language: cohortLang as "en" | "si" | "ta" }),
      ...(cohortDatesValid && cohortFrom ? { dateFrom: cohortFrom } : {}),
      ...(cohortDatesValid && cohortTo ? { dateTo: cohortTo } : {}),
    }),
    [slug, effectiveStatus, cohortLang, cohortFrom, cohortTo, cohortDatesValid],
  );
  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      ...(slug === "__all__" ? {} : { surveySlug: slug }),
      ...(cohortLang === "__all__" ? {} : { language: cohortLang as "en" | "si" | "ta" }),
      ...(cohortDatesValid && cohortFrom ? { dateFrom: cohortFrom } : {}),
      ...(cohortDatesValid && cohortTo ? { dateTo: cohortTo } : {}),
    }),
    [slug, page, cohortLang, cohortFrom, cohortTo, cohortDatesValid],
  );

  // Reset to first page whenever the survey filter changes.
  useEffect(() => {
    setPage(0);
  }, [slug, cohortLang, cohortFrom, cohortTo]);

  // ── Live analytics wiring ──────────────────────────────────────────────
  // The Dashboard supports two refresh paths on top of the filter-driven
  // initial fetch:
  //
  //   1. A 15s polling interval as the floor — works even when realtime
  //      is disabled, the tab is in the background (interval pauses on
  //      `document.hidden`), or the websocket can't connect.
  //   2. Supabase realtime `postgres_changes` on `public.responses` so
  //      new submissions surface within ~1s instead of waiting up to
  //      15s for the next poll. Bursts are coalesced through a 1500ms
  //      debounce so a 50-row import fires one refetch, not fifty.
  //
  // Both paths funnel through `loadStats({ background: true })` which
  // skips the full-page spinner so the charts re-render in place.
  // The "Refresh" button in the LiveStatusPill calls the same path
  // on demand. Filter changes (slug / status / page) still hit the
  // foreground path so the user gets the spinner on intent-driven
  // navigation but never on background refreshes.
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const realtimeDebounceRef = useRef<number | null>(null);

  const loadStats = useCallback(
    async ({ background }: { background: boolean } = { background: false }) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const [s, r] = await Promise.all([
          statsFn({ data: statsParams }),
          listFn({ data: listParams }),
        ]);
        setStats(s);
        setList(r);
        setUpdatedAt(Date.now());
      } catch (e) {
        // Background failures are silent — the pill shows the stale
        // "Updated Xs ago" so admins can see refresh has stopped working
        // without a toast firing every 15s on a flaky connection.
        if (!background) toast.error((e as Error).message);
        else console.warn(`[admin/live] background refresh failed: ${(e as Error).message}`);
      } finally {
        if (background) setRefreshing(false);
        else setLoading(false);
      }
    },
    [statsFn, listFn, statsParams, listParams],
  );

  // Foreground load on filter / page changes.
  useEffect(() => {
    loadStats({ background: false });
  }, [loadStats]);

  // Polling floor — 15s while live, paused while the tab is hidden so
  // we don't burn server time on a backgrounded admin tab.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadStats({ background: true });
      }
    }, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadStats({ background: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, loadStats]);

  // Realtime channel — coalesces bursts via a 1500ms trailing debounce.
  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel("admin-responses-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, () => {
        if (realtimeDebounceRef.current != null) {
          window.clearTimeout(realtimeDebounceRef.current);
        }
        realtimeDebounceRef.current = window.setTimeout(() => {
          realtimeDebounceRef.current = null;
          if (document.visibilityState === "visible") {
            loadStats({ background: true });
          }
        }, 1500);
      })
      .subscribe();
    return () => {
      if (realtimeDebounceRef.current != null) {
        window.clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [live, loadStats]);

  async function downloadCsv(targetSlug: string) {
    setExporting(targetSlug);
    try {
      const { csv, filename, rowCount } = await exportFn({ data: { surveySlug: targetSlug } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rowCount} row${rowCount === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  async function downloadAllValidCsv(resume?: {
    startPage: number;
    requestId: string;
    filename: string;
    total: number;
    pageSize: number;
    priorChunks: string[];
    priorRowCount: number;
  }) {
    setExporting("__all_valid__");
    // Clear any prior failed-run banner — a fresh attempt starts now.
    setFailedRun(null);
    clearCsvResume();
    const startedAt = performance.now();
    // When resuming, seed `lastProcessed` so the rate sampler doesn't
    // count the carry-over rows as a sudden burst.
    const seededProcessed = resume ? resume.priorRowCount : 0;
    allValidRateRef.current = {
      startedAt,
      lastSampleAt: startedAt,
      lastProcessed: seededProcessed,
      smoothedRate: 0,
      bytesProcessed: 0,
      rateHistory: [],
    };
    setAllValidProgress({
      processed: seededProcessed,
      total: resume?.total ?? 0,
      phase: resume ? "resuming" : "starting",
      rate: 0,
      etaSeconds: null,
      bytesProcessed: 0,
      rateHistory: [],
      ...(resume ? { resumeFromPage: resume.startPage } : {}),
    });
    setCurrentRequestId(resume?.requestId ?? null);
    allValidCancelRef.current = false;
    setAllValidCancelling(false);
    pauseGateRef.current = null;
    setAllValidPaused(false);
    const abortController = new AbortController();
    allValidAbortRef.current = abortController;
    // Seed local CSV buffer. On a fresh run start with the BOM; on
    // resume reuse the prior chunks (BOM + header + already-streamed
    // pages) so the final blob is one continuous CSV.
    const chunks: string[] = resume ? [...resume.priorChunks] : ["\uFEFF"];
    let filename = resume?.filename ?? "eip-insight-all-valid-responses.csv";
    let finalRowCount = resume?.priorRowCount ?? 0;
    let cancelled = false;
    let stream: Awaited<ReturnType<typeof streamAllFn>> | undefined;
    // Track the last successfully appended page so a transient failure
    // can offer "Resume from last page" wired to `lastPage + 1`.
    let lastPage = resume ? resume.startPage - 1 : -1;
    let runTotal = resume?.total ?? 0;
    let runPageSize = resume?.pageSize ?? 500;
    let runRequestId = resume?.requestId ?? "";
    // Captured from the meta event; used by the continuity sanitizer
    // to strip any re-emitted header from a chunk and by the final
    // assembly validator to assert the file structure.
    let runHeaderLine = "";
    // Resume de-dup: track every page index already represented in the
    // assembled chunks so a server replay (or a bug that double-emits a
    // page within one run) cannot introduce duplicate rows. On resume
    // we seed the set with every page already in the prior buffer
    // (0..startPage-1); on a fresh run it stays empty until the first
    // chunk lands. `duplicateCsvPages` counts skipped overlaps so the
    // success toast can flag them; an entry-level snapshot is logged
    // for forensics so the requestId can be cross-referenced in worker
    // logs.
    const seenCsvPages = new Set<number>();
    let duplicateCsvPages = 0;
    // Streaming integrity: per-chunk CRC32 verification + a rolling
    // CRC32 + SHA-256 over the bytes streamed in this run. The server
    // emits a `checksum` envelope just before `done` covering header +
    // chunks; we recompute over the same byte sequence and abort the
    // download on mismatch. On resume the server only re-emits from
    // `startPage` onward, so the run-level digest covers only this
    // run's bytes (not the prior buffer).
    let runCrcState = CRC32_INIT;
    const runShaParts: Uint8Array[] = [];
    let runByteLen = 0;
    let serverChecksum: { crc32: string; sha256: string; byteLength: number } | null = null;
    let chunkCrcMismatches = 0;
    let continuityChecksPassed = 0;
    let checksumStatus: "pending" | "ok" | "fail" = "pending";
    /** Snapshot of the running integrity report fed into every progress
     *  setState so the AllValidProgressCard can render pages received,
     *  continuity checks passed, detected gaps, and checksum status. */
    const buildIntegrity = (): NonNullable<AllValidProgress["integrity"]> => {
      let minPage: number | null = null;
      let maxPage: number | null = null;
      for (const p of seenCsvPages) {
        if (minPage === null || p < minPage) minPage = p;
        if (maxPage === null || p > maxPage) maxPage = p;
      }
      const gaps: number[] = [];
      if (minPage !== null && maxPage !== null) {
        for (let p = minPage; p <= maxPage && gaps.length < 10; p++) {
          if (!seenCsvPages.has(p)) gaps.push(p);
        }
      }
      return {
        pagesReceived: seenCsvPages.size,
        minPage,
        maxPage,
        continuityChecksPassed,
        chunkCrcMismatches,
        duplicatesDropped: duplicateCsvPages,
        gaps,
        checksum: checksumStatus,
      };
    };
    if (resume) {
      for (let p = 0; p < resume.startPage; p++) seenCsvPages.add(p);
      partialBufferRef.current = {
        filename,
        total: resume.total,
        pageSize: resume.pageSize,
        requestId: resume.requestId,
        chunks: [...resume.priorChunks],
        rowCount: resume.priorRowCount,
        lastPage: resume.startPage - 1,
      };
    } else {
      partialBufferRef.current = null;
    }

    /** Update throughput tracking and derive a stable ETA. Also folds
     *  the latest streamed-byte total + a capped rate-history sample
     *  into the ref so the progress card can render the remaining-size
     *  estimate and the rows/sec sparkline. */
    const sampleProgress = (
      processed: number,
      total: number,
      chunkBytes: number,
    ): {
      rate: number;
      etaSeconds: number | null;
      bytesProcessed: number;
      rateHistory: number[];
    } => {
      const ref = allValidRateRef.current;
      if (!ref) return { rate: 0, etaSeconds: null, bytesProcessed: 0, rateHistory: [] };
      const now = performance.now();
      const dtSec = Math.max(0.001, (now - ref.lastSampleAt) / 1000);
      const dProcessed = Math.max(0, processed - ref.lastProcessed);
      const instantRate = dProcessed / dtSec;
      // EWMA: alpha=0.3 → reactive but not jittery. First real sample
      // bootstraps the smoothed value to avoid a slow ramp-up.
      const smoothed =
        ref.smoothedRate === 0 ? instantRate : 0.3 * instantRate + 0.7 * ref.smoothedRate;
      ref.lastSampleAt = now;
      ref.lastProcessed = processed;
      ref.smoothedRate = smoothed;
      ref.bytesProcessed += Math.max(0, chunkBytes);
      const nextHistory = [...ref.rateHistory, smoothed];
      if (nextHistory.length > RATE_HISTORY_CAP) {
        nextHistory.splice(0, nextHistory.length - RATE_HISTORY_CAP);
      }
      ref.rateHistory = nextHistory;
      const remaining = total > 0 ? Math.max(0, total - processed) : 0;
      const etaSeconds = total > 0 && smoothed > 0 ? remaining / smoothed : null;
      return {
        rate: smoothed,
        etaSeconds,
        bytesProcessed: ref.bytesProcessed,
        rateHistory: nextHistory,
      };
    };

    /** Snapshot the cancelled state into the progress card so it
     *  reads "Export cancelled — N rows fetched" until the admin
     *  dismisses it. Called from both the cooperative break path and
     *  the AbortError catch path so either route reaches the same
     *  terminal UI. */
    const flipToCancelledPhase = () => {
      const got = allValidRateRef.current?.lastProcessed ?? 0;
      setAllValidProgress((p) =>
        p
          ? { ...p, processed: got, phase: "cancelled", etaSeconds: null, rate: 0 }
          : {
              processed: got,
              total: 0,
              phase: "cancelled",
              rate: 0,
              etaSeconds: null,
            },
      );
    };

    try {
      stream = await streamAllFn({
        signal: abortController.signal,
        data: {
          maxAttempts: retryPrefs.maxAttempts,
          baseDelayMs: retryPrefs.baseDelayMs,
          backoffFactor: retryPrefs.backoffFactor,
          ...(resume ? { startPage: resume.startPage, requestId: resume.requestId } : {}),
        },
      });
      for await (const evt of stream) {
        if (pauseGateRef.current !== null) {
          await (pauseGateRef.current as PauseGate).promise;
          if (allValidRateRef.current) {
            allValidRateRef.current.lastSampleAt = performance.now();
          }
        }
        if (allValidCancelRef.current) {
          cancelled = true;
          break;
        }
        if (evt.type === "meta") {
          filename = evt.filename;
          runTotal = evt.total;
          runPageSize = evt.pageSize ?? runPageSize;
          runRequestId = evt.requestId ?? runRequestId;
          runHeaderLine = evt.headerLine;
          setCurrentRequestId(runRequestId || null);
          // Only push the header when this is a fresh run; on resume
          // the header line is already in `chunks` from the prior run.
          if (!resume) {
            chunks.push(evt.headerLine + "\n");
            // Seed the run-level digests with the same header bytes the
            // server hashes on a fresh run.
            const headerBytes = utf8(evt.headerLine + "\n");
            runCrcState = crc32Update(runCrcState, headerBytes);
            runShaParts.push(headerBytes);
            runByteLen += headerBytes.byteLength;
          } else {
            // Re-validate the carried-over buffer using the fresh
            // headerLine. Catches corruption that may have crept in via
            // a stale localStorage payload before any new chunk lands.
            const carryCheck = validateAssembledCsv(chunks, runHeaderLine);
            if (!carryCheck.ok) {
              throw new Error(`Resume buffer continuity check failed: ${carryCheck.reason}`);
            }
          }
          // Initialise / refresh the partial buffer with fresh meta.
          partialBufferRef.current = {
            filename,
            total: runTotal,
            pageSize: runPageSize,
            requestId: runRequestId,
            chunks: [...chunks],
            rowCount: finalRowCount,
            lastPage,
          };
          setAllValidProgress({
            processed: seededProcessed,
            total: evt.total,
            phase: "fetching",
            rate: 0,
            etaSeconds: null,
            bytesProcessed: allValidRateRef.current?.bytesProcessed ?? 0,
            rateHistory: allValidRateRef.current?.rateHistory ?? [],
          });
        } else if (evt.type === "chunk") {
          // Resume de-dup: drop any chunk whose page index is already
          // represented in the assembled buffer. Triggered when the
          // server replays a page (network blip + retry on its side)
          // or when a buggy resume restarts before `lastPage`. Skipping
          // here keeps `processed`/`rowCount` in sync because the
          // server's own `evt.processed` already excludes the replayed
          // rows from its monotonic counter — but if it doesn't, the
          // dedup still wins and the success toast surfaces the count.
          if (typeof evt.page === "number" && seenCsvPages.has(evt.page)) {
            duplicateCsvPages++;
            continue;
          }
          // Sanitize each chunk before it lands in the buffer:
          //  • strip any stray BOM (only the seeded entry may carry one)
          //  • drop a re-emitted header line on a resumed page
          //  • guarantee a trailing `\n` so page boundaries don't fuse rows
          // Per-chunk CRC32 verification BEFORE sanitisation. The
          // server hashed the raw `csv` string it emitted; we hash the
          // same bytes and compare. A mismatch means the chunk was
          // corrupted in transit — surface a warning, count it, and
          // still try to assemble (final SHA/CRC will catch it again).
          const rawChunkBytes = utf8(evt.csv);
          if (typeof evt.crc32 === "string") {
            const localCrc = crc32OfBytes(rawChunkBytes);
            const sizeOk =
              typeof evt.byteLength !== "number" || evt.byteLength === rawChunkBytes.byteLength;
            if (localCrc !== evt.crc32 || !sizeOk) {
              chunkCrcMismatches++;
              toast.warning(`CSV chunk CRC mismatch on page ${evt.page}`, {
                description: `expected=${evt.crc32}, got=${localCrc}${sizeOk ? "" : `, size=${rawChunkBytes.byteLength}/${evt.byteLength}`}`,
              });
            } else {
              continuityChecksPassed++;
            }
          }
          const safeCsv = sanitizeCsvChunk(evt.csv, runHeaderLine);
          chunks.push(safeCsv);
          // Fold the *raw* chunk bytes (pre-sanitisation) into the
          // run-level digests so they line up with the server's hash.
          runCrcState = crc32Update(runCrcState, rawChunkBytes);
          runShaParts.push(rawChunkBytes);
          runByteLen += rawChunkBytes.byteLength;
          const chunkBytes = safeCsv.length;
          const { rate, etaSeconds, bytesProcessed, rateHistory } = sampleProgress(
            evt.processed,
            evt.total,
            chunkBytes,
          );
          // Track the highest successfully appended page so a transient
          // failure can resume from `lastPage + 1` instead of restarting.
          if (typeof evt.page === "number") {
            seenCsvPages.add(evt.page);
            if (evt.page > lastPage) lastPage = evt.page;
          }
          finalRowCount = evt.processed;
          if (partialBufferRef.current) {
            partialBufferRef.current.chunks.push(safeCsv);
            partialBufferRef.current.rowCount = evt.processed;
            partialBufferRef.current.lastPage = lastPage;
          }
          setAllValidProgress({
            processed: evt.processed,
            total: evt.total,
            phase: "fetching",
            rate,
            etaSeconds,
            bytesProcessed,
            rateHistory,
            integrity: buildIntegrity(),
          });
        } else if (evt.type === "checksum") {
          serverChecksum = { crc32: evt.crc32, sha256: evt.sha256, byteLength: evt.byteLength };
        } else if (evt.type === "done") {
          finalRowCount = evt.rowCount;
          setAllValidProgress((p) =>
            p
              ? {
                  ...p,
                  processed: evt.rowCount,
                  phase: "finalizing",
                  etaSeconds: 0,
                  integrity: buildIntegrity(),
                }
              : p,
          );
        } else if (evt.type === "warn") {
          toast.warning(`${evt.label} — retry ${evt.attempt}/${evt.maxAttempts}`, {
            description: evt.message,
          });
        }
      }
      if (cancelled) {
        abortController.abort();
        try {
          await (stream as AsyncIterator<unknown>)?.return?.(undefined);
        } catch {
          /* ignore */
        }
        flipToCancelledPhase();
        toast.info("Export cancelled");
        return;
      }
      // Defensive sanity check before handing the blob to the browser:
      // exactly one BOM, header in position, no duplicate header rows,
      // and a newline-terminated final row. A failure here lands the
      // run in the failed-run banner with a clear reason instead of
      // silently shipping a malformed CSV.
      // Continuity validation with bounded automatic retry. If the
      // assembled CSV fails validation, walk backwards through `chunks`
      // popping the trailing page until the prefix passes — that
      // localises the corruption to a single page boundary. We then
      // re-fetch from `lastValidPage + 1` (same `requestId`) and feed
      // each new chunk through the same `sanitizeCsvChunk` + dedup
      // path. Up to `MAX_CONTINUITY_AUTO_RETRIES` rounds; on the final
      // failure we fall through to the existing throw so the failed-run
      // banner + persisted resume buffer still kick in.
      const MAX_CONTINUITY_AUTO_RETRIES = 2;
      let continuity = validateAssembledCsv(chunks, runHeaderLine);
      let continuityAttempt = 0;
      while (!continuity.ok && continuityAttempt < MAX_CONTINUITY_AUTO_RETRIES) {
        continuityAttempt++;
        // Trim trailing pages until the prefix validates again.
        // chunks[0] is the BOM, chunks[1] the header — never pop
        // those; if no prefix above the header validates, abort the
        // auto-retry (resume from page 0 isn't safer than the manual
        // path). Each pop corresponds to one page in `lastPage`.
        let trimmedLastPage = lastPage;
        while (chunks.length > 2) {
          chunks.pop();
          if (trimmedLastPage >= 0) {
            seenCsvPages.delete(trimmedLastPage);
            trimmedLastPage--;
          }
          if (validateAssembledCsv(chunks, runHeaderLine).ok) break;
        }
        const trimmedOk = validateAssembledCsv(chunks, runHeaderLine);
        if (!trimmedOk.ok || trimmedLastPage < 0) {
          // Couldn't trim to a valid prefix — give up and let the
          // outer error path handle it with the original failure
          // reason (continuity already holds it).
          break;
        }
        lastPage = trimmedLastPage;
        finalRowCount = (trimmedLastPage + 1) * runPageSize; // rough; refined by next chunk's evt.processed
        if (partialBufferRef.current) {
          partialBufferRef.current.chunks = [...chunks];
          partialBufferRef.current.lastPage = lastPage;
          partialBufferRef.current.rowCount = finalRowCount;
        }
        const reqLabel = runRequestId ? ` (requestId=${runRequestId})` : "";
        toast.warning(
          `CSV continuity failed at page ${typeof continuity.chunkIndex === "number" && continuity.chunkIndex >= 2 ? continuity.chunkIndex - 2 : "?"} — auto-retrying from page ${lastPage + 1} (attempt ${continuityAttempt}/${MAX_CONTINUITY_AUTO_RETRIES})${reqLabel}`,
          { description: `Reason: ${continuity.reason}. Re-sanitising from the last valid page.` },
        );
        // Surface the in-flight retry in the progress card.
        setAllValidProgress({
          processed: finalRowCount,
          total: runTotal,
          phase: "resuming",
          rate: 0,
          etaSeconds: null,
          bytesProcessed: 0,
          rateHistory: [],
          resumeFromPage: lastPage + 1,
        });
        // Reset the rate sampler so the new run isn't blended.
        if (allValidRateRef.current) {
          allValidRateRef.current.lastSampleAt = performance.now();
          allValidRateRef.current.lastProcessed = finalRowCount;
          allValidRateRef.current.smoothedRate = 0;
          allValidRateRef.current.bytesProcessed = 0;
          allValidRateRef.current.rateHistory = [];
        }
        // Reset run-level digests — the server's `checksum` envelope on
        // the retry covers only the bytes it re-emits from `startPage`
        // onward (header is NOT re-seeded server-side when startPage>0).
        runCrcState = CRC32_INIT;
        runShaParts.length = 0;
        runByteLen = 0;
        serverChecksum = null;
        // Re-issue the stream with the trimmed startPage. Reuses the
        // same requestId so worker logs stay correlatable across the
        // auto-retry chain.
        const retryStream = await streamAllFn({
          signal: abortController.signal,
          data: {
            maxAttempts: retryPrefs.maxAttempts,
            baseDelayMs: retryPrefs.baseDelayMs,
            backoffFactor: retryPrefs.backoffFactor,
            startPage: lastPage + 1,
            requestId: runRequestId,
          },
        });
        for await (const evt of retryStream) {
          if (allValidCancelRef.current) {
            cancelled = true;
            break;
          }
          if (evt.type === "meta") {
            // Header / total / pageSize already known — ignore the
            // re-emitted meta fields beyond refreshing requestId.
            runRequestId = evt.requestId ?? runRequestId;
            runHeaderLine = evt.headerLine || runHeaderLine;
          } else if (evt.type === "chunk") {
            if (typeof evt.page === "number" && seenCsvPages.has(evt.page)) {
              duplicateCsvPages++;
              continue;
            }
            const rawChunkBytes = utf8(evt.csv);
            if (typeof evt.crc32 === "string") {
              const localCrc = crc32OfBytes(rawChunkBytes);
              const sizeOk =
                typeof evt.byteLength !== "number" || evt.byteLength === rawChunkBytes.byteLength;
              if (localCrc !== evt.crc32 || !sizeOk) {
                chunkCrcMismatches++;
                toast.warning(`CSV chunk CRC mismatch on page ${evt.page} (auto-retry)`, {
                  description: `expected=${evt.crc32}, got=${localCrc}${sizeOk ? "" : `, size=${rawChunkBytes.byteLength}/${evt.byteLength}`}`,
                });
              } else {
                continuityChecksPassed++;
              }
            }
            const safeCsv = sanitizeCsvChunk(evt.csv, runHeaderLine);
            chunks.push(safeCsv);
            runCrcState = crc32Update(runCrcState, rawChunkBytes);
            runShaParts.push(rawChunkBytes);
            runByteLen += rawChunkBytes.byteLength;
            const chunkBytes = safeCsv.length;
            const sample = sampleProgress(evt.processed, evt.total, chunkBytes);
            if (typeof evt.page === "number") {
              seenCsvPages.add(evt.page);
              if (evt.page > lastPage) lastPage = evt.page;
            }
            finalRowCount = evt.processed;
            if (partialBufferRef.current) {
              partialBufferRef.current.chunks.push(safeCsv);
              partialBufferRef.current.rowCount = evt.processed;
              partialBufferRef.current.lastPage = lastPage;
            }
            setAllValidProgress({
              processed: evt.processed,
              total: evt.total,
              phase: "fetching",
              rate: sample.rate,
              etaSeconds: sample.etaSeconds,
              bytesProcessed: sample.bytesProcessed,
              rateHistory: sample.rateHistory,
              integrity: buildIntegrity(),
            });
          } else if (evt.type === "checksum") {
            serverChecksum = { crc32: evt.crc32, sha256: evt.sha256, byteLength: evt.byteLength };
          } else if (evt.type === "done") {
            finalRowCount = evt.rowCount;
          } else if (evt.type === "warn") {
            toast.warning(`${evt.label} — retry ${evt.attempt}/${evt.maxAttempts}`, {
              description: evt.message,
            });
          }
        }
        if (cancelled) break;
        continuity = validateAssembledCsv(chunks, runHeaderLine);
      }
      if (!continuity.ok) {
        // Surface a prominent warning in the progress card BEFORE
        // throwing into the failed-run banner. The card shows the
        // failure reason, the offending page (mapped from the chunk
        // index — chunks[0]=BOM, chunks[1]=header, chunks[2..N]=pages
        // 0..N-2), the auto-retry attempt count, and a "Retry from
        // last successful page" CTA wired straight into the resume
        // flow. Throwing afterwards keeps the failed-run banner +
        // persisted resume buffer behaviour unchanged.
        const ci = continuity.chunkIndex;
        const pageOfChunk = typeof ci === "number" && ci >= 2 ? ci - 2 : undefined;
        const exhaustedNote =
          continuityAttempt > 0
            ? ` Auto-retry exhausted after ${continuityAttempt}/${MAX_CONTINUITY_AUTO_RETRIES} attempt${continuityAttempt === 1 ? "" : "s"}.`
            : "";
        setAllValidProgress((prev) =>
          prev
            ? {
                ...prev,
                integrity: buildIntegrity(),
                continuityError: {
                  reason: continuity.reason,
                  chunkIndex: ci,
                  page: pageOfChunk,
                  suggestion:
                    (pageOfChunk != null
                      ? `Retry the export from the last successfully appended page (page ${lastPage}). The offending data was introduced at page ${pageOfChunk}.`
                      : `Retry the export from the last successfully appended page (page ${lastPage}).`) +
                    exhaustedNote,
                },
              }
            : prev,
        );
        throw new Error(`CSV continuity check failed: ${continuity.reason}`);
      }
      if (continuityAttempt > 0) {
        toast.success(
          `Continuity recovered after ${continuityAttempt} auto-retry${continuityAttempt === 1 ? "" : "s"}`,
          { description: `requestId=${runRequestId || "unknown"}` },
        );
      }
      // End-of-file integrity check. Concatenate the run-level bytes,
      // recompute SHA-256 + CRC32, and compare against the server's
      // `checksum` envelope. On mismatch we surface a continuityError
      // and abort the download — better to fail loudly than to ship a
      // corrupted CSV. The chunk-level CRC mismatch counter is also
      // surfaced so it's clear whether corruption was per-chunk or
      // accumulated.
      let runShaHex = "";
      let runCrcHex = "";
      if (serverChecksum) {
        const total = new Uint8Array(runByteLen);
        let off = 0;
        for (const part of runShaParts) {
          total.set(part, off);
          off += part.byteLength;
        }
        runShaHex = await sha256Hex(total);
        runCrcHex = crc32Hex(runCrcState);
        const sizeOk = serverChecksum.byteLength === runByteLen;
        if (runShaHex !== serverChecksum.sha256 || runCrcHex !== serverChecksum.crc32 || !sizeOk) {
          checksumStatus = "fail";
          const reason = `End-of-file checksum mismatch (sha256 server=${serverChecksum.sha256} client=${runShaHex}; crc32 server=${serverChecksum.crc32} client=${runCrcHex}; bytes server=${serverChecksum.byteLength} client=${runByteLen})`;
          setAllValidProgress((prev) =>
            prev
              ? {
                  ...prev,
                  integrity: buildIntegrity(),
                  continuityError: {
                    reason,
                    suggestion: `Retry the export from the last successfully appended page (page ${lastPage}). The assembled CSV does not match the server's checksum.`,
                  },
                }
              : prev,
          );
          throw new Error(reason);
        }
        checksumStatus = "ok";
        setAllValidProgress((prev) => (prev ? { ...prev, integrity: buildIntegrity() } : prev));
      }
      // Append a checksum trailer so the downloaded file carries proof
      // of integrity. Format (CSV-comment style; consumers that don't
      // recognise it will see a single trailing data row):
      //   # eip-checksum sha256=<hex>; crc32=<hex>; bytes=<n>; rows=<n>; requestId=<id>
      const trailer = `# eip-checksum sha256=${serverChecksum?.sha256 ?? runShaHex ?? "unknown"}; crc32=${serverChecksum?.crc32 ?? runCrcHex ?? "unknown"}; bytes=${runByteLen}; rows=${finalRowCount}; requestId=${runRequestId || "unknown"}\n`;
      const blob = new Blob([...chunks, trailer], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const descParts: string[] = [`requestId=${runRequestId || "unknown"}`];
      if (duplicateCsvPages > 0)
        descParts.unshift(
          `Resume de-dup dropped ${duplicateCsvPages} duplicate page${duplicateCsvPages === 1 ? "" : "s"}`,
        );
      if (chunkCrcMismatches > 0)
        descParts.unshift(
          `${chunkCrcMismatches} chunk CRC mismatch${chunkCrcMismatches === 1 ? "" : "es"} (auto-recovered)`,
        );
      if (serverChecksum) descParts.push(`sha256=${serverChecksum.sha256.slice(0, 12)}…`);
      toast.success(`Exported ${finalRowCount} valid response${finalRowCount === 1 ? "" : "s"}`, {
        description: descParts.join(" · "),
        action: viewLogsAction(runRequestId),
      });
      setAllValidProgress(null);
      // Successful run — drop the partial buffer / failed-run banner.
      partialBufferRef.current = null;
      setFailedRun(null);
      clearCsvResume();
      setCurrentRequestId(null);
    } catch (e) {
      if (allValidCancelRef.current || abortController.signal.aborted) {
        flipToCancelledPhase();
        toast.info("Export cancelled");
        // Cancelled — discard the partial buffer; resume isn't offered
        // for explicit cancels.
        partialBufferRef.current = null;
        setFailedRun(null);
        clearCsvResume();
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        const got = allValidRateRef.current?.lastProcessed ?? 0;
        // Capture state for the resume banner before the refs reset
        // in the finally block.
        const buf = partialBufferRef.current;
        const canResume = !!buf && lastPage >= 0 && (runTotal === 0 || got < runTotal);
        if (buf) {
          buf.rowCount = got;
          buf.lastPage = lastPage;
        }
        const failedRunPayload = {
          error: msg,
          requestId: runRequestId || buf?.requestId || "unknown",
          rowCount: got,
          lastPage,
          canResume,
        };
        setFailedRun(failedRunPayload);
        // Persist so the admin can resume after a full page refresh.
        if (canResume && buf) {
          saveCsvResume(buf, {
            error: failedRunPayload.error,
            requestId: failedRunPayload.requestId,
            rowCount: failedRunPayload.rowCount,
            lastPage: failedRunPayload.lastPage,
          });
        } else {
          clearCsvResume();
        }
        const reqLabel = runRequestId ? ` [requestId=${runRequestId}]` : "";
        const description = canResume
          ? `Streamed ${got.toLocaleString()} row${got === 1 ? "" : "s"} (page ${lastPage}). You can resume from the last page.${reqLabel}`
          : got > 0
            ? `Streamed ${got.toLocaleString()} row${got === 1 ? "" : "s"} before failure.${reqLabel}`
            : `No rows were streamed before the failure.${reqLabel}`;
        toast.error(`Export failed: ${msg}`, { description, action: viewLogsAction(runRequestId) });
        setAllValidProgress(null);
      }
    } finally {
      setExporting(null);
      setAllValidCancelling(false);
      allValidCancelRef.current = false;
      allValidRateRef.current = null;
      allValidAbortRef.current = null;
      pauseGateRef.current = null;
      setAllValidPaused(false);
    }
  }

  /** Continue a failed streaming run from the last successfully
   *  appended page, reusing the prior CSV buffer + requestId so the
   *  final file is one continuous CSV and worker logs can be matched
   *  to the same correlation ID. */
  function resumeAllValidCsvFromLastPage() {
    const buf = partialBufferRef.current;
    const fr = failedRun;
    if (!buf || !fr || !fr.canResume) return;
    void downloadAllValidCsv({
      startPage: buf.lastPage + 1,
      requestId: buf.requestId,
      filename: buf.filename,
      total: buf.total,
      pageSize: buf.pageSize,
      priorChunks: [...buf.chunks],
      priorRowCount: buf.rowCount,
    });
  }

  function dismissFailedRun() {
    setFailedRun(null);
    partialBufferRef.current = null;
    clearCsvResume();
    setCurrentRequestId(null);
  }

  // ── Streaming all-valid XLSX export ─────────────────────────────────
  async function downloadAllValidXlsx(resume?: {
    startPage: number;
    requestId: string;
    filename: string;
    total: number;
    pageSize: number;
    headerRow: string[];
    priorRows: (string | number | boolean | null)[][];
    priorRowCount: number;
  }) {
    setExporting("__all_valid_xlsx__");
    setXlsxFailedRun(null);
    clearXlsxResume();
    setXlsxAllValidProgress({
      processed: resume?.priorRowCount ?? 0,
      total: resume?.total ?? 0,
      phase: resume ? "resuming" : "starting",
      ...(resume ? { resumeFromPage: resume.startPage } : {}),
    });
    const abortController = new AbortController();
    xlsxAbortRef.current = abortController;

    let filename = resume?.filename ?? "eip-insight-all-valid-responses.xlsx";
    let runTotal = resume?.total ?? 0;
    let runPageSize = resume?.pageSize ?? 500;
    let runRequestId = resume?.requestId ?? "";
    setXlsxCurrentRequestId(resume?.requestId ?? null);
    let headerRow: string[] = resume?.headerRow ?? [];
    const allRows: (string | number | boolean | null)[][] = resume ? [...resume.priorRows] : [];
    let lastPage = resume ? resume.startPage - 1 : -1;
    let finalRowCount = resume?.priorRowCount ?? 0;
    // Resume de-dup (XLSX): same shape as the CSV streamer — track
    // every page already represented in the assembled `allRows` so a
    // server replay or buggy resume cannot leak duplicate rows into
    // the final workbook. Seeded with `0..startPage-1` on resume.
    const seenXlsxPages = new Set<number>();
    let duplicateXlsxPages = 0;
    if (resume) {
      for (let p = 0; p < resume.startPage; p++) seenXlsxPages.add(p);
    }

    if (resume) {
      xlsxPartialBufferRef.current = {
        filename,
        total: resume.total,
        pageSize: resume.pageSize,
        requestId: resume.requestId,
        headerRow: [...resume.headerRow],
        rows: [...resume.priorRows],
        rowCount: resume.priorRowCount,
        lastPage: resume.startPage - 1,
      };
    } else {
      xlsxPartialBufferRef.current = null;
    }

    try {
      const stream = await streamAllXlsxFn({
        signal: abortController.signal,
        data: {
          maxAttempts: retryPrefs.maxAttempts,
          baseDelayMs: retryPrefs.baseDelayMs,
          backoffFactor: retryPrefs.backoffFactor,
          ...(resume ? { startPage: resume.startPage, requestId: resume.requestId } : {}),
        },
      });
      for await (const evt of stream) {
        if (evt.type === "meta") {
          filename = evt.filename;
          runTotal = evt.total;
          runPageSize = evt.pageSize ?? runPageSize;
          runRequestId = evt.requestId ?? runRequestId;
          if (runRequestId) setXlsxCurrentRequestId(runRequestId);
          headerRow = evt.headerRow;
          xlsxPartialBufferRef.current = {
            filename,
            total: runTotal,
            pageSize: runPageSize,
            requestId: runRequestId,
            headerRow: [...headerRow],
            rows: [...allRows],
            rowCount: finalRowCount,
            lastPage,
          };
          setXlsxAllValidProgress({
            processed: finalRowCount,
            total: evt.total,
            phase: "fetching",
          });
        } else if (evt.type === "chunk") {
          // Resume de-dup: drop the page entirely if its index is
          // already in the assembled buffer. The XLSX rows have no
          // stable id we can hash, so page-level dedup is the right
          // granularity — pages are atomic on the wire.
          if (typeof evt.page === "number" && seenXlsxPages.has(evt.page)) {
            duplicateXlsxPages++;
            continue;
          }
          for (const row of evt.rows) allRows.push(row);
          if (typeof evt.page === "number") {
            seenXlsxPages.add(evt.page);
            if (evt.page > lastPage) lastPage = evt.page;
          }
          finalRowCount = evt.processed;
          if (xlsxPartialBufferRef.current) {
            for (const row of evt.rows) {
              xlsxPartialBufferRef.current.rows.push(row);
            }
            xlsxPartialBufferRef.current.rowCount = evt.processed;
            xlsxPartialBufferRef.current.lastPage = lastPage;
          }
          setXlsxAllValidProgress({
            processed: evt.processed,
            total: evt.total,
            phase: "fetching",
          });
        } else if (evt.type === "done") {
          finalRowCount = evt.rowCount;
          setXlsxAllValidProgress({
            processed: evt.rowCount,
            total: runTotal,
            phase: "finalizing",
          });
        } else if (evt.type === "warn") {
          toast.warning(`${evt.label} — retry ${evt.attempt}/${evt.maxAttempts}`, {
            description: evt.message,
          });
        }
      }

      const XLSX = await import("xlsx");
      const aoa: (string | number | boolean | null)[][] = [headerRow, ...allRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number)[][]);
      ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
      for (let c = 0; c < headerRow.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        const cell = ws[addr];
        if (cell) cell.s = { font: { bold: true } };
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responses");
      const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${finalRowCount} valid response${finalRowCount === 1 ? "" : "s"} (XLSX)`,
        {
          description:
            duplicateXlsxPages > 0
              ? `Resume de-dup dropped ${duplicateXlsxPages} duplicate page${duplicateXlsxPages === 1 ? "" : "s"} (requestId=${runRequestId || "unknown"})`
              : `requestId=${runRequestId || "unknown"}`,
          action: viewLogsAction(runRequestId),
        },
      );
      setXlsxAllValidProgress(null);
      xlsxPartialBufferRef.current = null;
      setXlsxFailedRun(null);
      setXlsxCurrentRequestId(null);
      clearXlsxResume();
    } catch (e) {
      if (abortController.signal.aborted) {
        setXlsxAllValidProgress((p) => (p ? { ...p, phase: "cancelled" } : null));
        toast.info(
          "XLSX export cancelled",
          runRequestId ? { description: `requestId=${runRequestId}` } : undefined,
        );
        xlsxPartialBufferRef.current = null;
        setXlsxFailedRun(null);
        clearXlsxResume();
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        const got = finalRowCount;
        const buf = xlsxPartialBufferRef.current;
        const canResume = !!buf && lastPage >= 0 && (runTotal === 0 || got < runTotal);
        if (buf) {
          buf.rowCount = got;
          buf.lastPage = lastPage;
        }
        // Detect the streamer's "<label> failed after N attempts
        // [requestId=…]: <orig>" envelope so the banner can switch to a
        // dedicated "Retries exhausted" state with the inner error and
        // the active backoff settings spelled out.
        const exhaustedMatch = msg.match(
          /^(.+?) failed after (\d+) attempts(?: \[requestId=[^\]]*\])?: ([\s\S]+)$/,
        );
        const exhausted = exhaustedMatch
          ? {
              attempts: Number(exhaustedMatch[2]) || retryPrefs.maxAttempts,
              lastErrorMessage: exhaustedMatch[3].trim(),
              backoff: {
                maxAttempts: retryPrefs.maxAttempts,
                baseDelayMs: retryPrefs.baseDelayMs,
                backoffFactor: retryPrefs.backoffFactor,
              },
            }
          : undefined;
        const failedRunPayload = {
          error: msg,
          requestId: runRequestId || buf?.requestId || "unknown",
          rowCount: got,
          lastPage,
          canResume,
          ...(exhausted ? { exhausted } : {}),
        };
        setXlsxFailedRun(failedRunPayload);
        if (canResume && buf) {
          saveXlsxResume(buf, {
            error: failedRunPayload.error,
            requestId: failedRunPayload.requestId,
            rowCount: failedRunPayload.rowCount,
            lastPage: failedRunPayload.lastPage,
          });
        } else {
          clearXlsxResume();
        }
        const reqLabel = runRequestId ? ` [requestId=${runRequestId}]` : "";
        const headline = exhausted
          ? `XLSX export retries exhausted (${exhausted.attempts}/${exhausted.attempts}): ${exhausted.lastErrorMessage}`
          : `XLSX export failed: ${msg}`;
        const description = canResume
          ? `Streamed ${got.toLocaleString()} row${got === 1 ? "" : "s"} (page ${lastPage}). You can resume from the last page.${reqLabel}`
          : got > 0
            ? `Streamed ${got.toLocaleString()} row${got === 1 ? "" : "s"} before failure.${reqLabel}`
            : `No rows were streamed before the failure.${reqLabel}`;
        toast.error(headline, { description, action: viewLogsAction(runRequestId) });
        setXlsxAllValidProgress(null);
      }
    } finally {
      setExporting(null);
      xlsxAbortRef.current = null;
    }
  }

  function resumeAllValidXlsxFromLastPage() {
    const buf = xlsxPartialBufferRef.current;
    const fr = xlsxFailedRun;
    if (!buf || !fr || !fr.canResume) return;
    toast.info(`Resuming XLSX export from page ${buf.lastPage + 1}`, {
      description: `requestId=${buf.requestId}`,
    });
    void downloadAllValidXlsx({
      startPage: buf.lastPage + 1,
      requestId: buf.requestId,
      filename: buf.filename,
      total: buf.total,
      pageSize: buf.pageSize,
      headerRow: [...buf.headerRow],
      priorRows: [...buf.rows],
      priorRowCount: buf.rowCount,
    });
  }

  function cancelAllValidXlsx() {
    xlsxAbortRef.current?.abort();
  }

  function dismissXlsxFailedRun() {
    setXlsxFailedRun(null);
    setXlsxCurrentRequestId(null);
    xlsxPartialBufferRef.current = null;
    clearXlsxResume();
  }

  /** First step of cancellation — open the confirmation dialog so a
   *  misclick on "Cancel" doesn't discard a multi-minute streaming
   *  export. The actual abort happens in `confirmCancelAllValidCsv`. */
  function cancelAllValidCsv() {
    if (!allValidCancelRef.current) {
      setConfirmCancelAllValidOpen(true);
    }
  }

  /** Confirmed cancel — flip the cooperative flag, abort the request
   *  signal so the server-side stream closes, and let the for-await
   *  loop fall into the cancelled-phase render. */
  function confirmCancelAllValidCsv() {
    setConfirmCancelAllValidOpen(false);
    if (!allValidCancelRef.current) {
      allValidCancelRef.current = true;
      setAllValidCancelling(true);
      // If the run is paused, resolve the gate so the for-await
      // unblocks and falls into the cancelled break path.
      if (pauseGateRef.current) {
        const gate = pauseGateRef.current;
        pauseGateRef.current = null;
        (gate as PauseGate).resolve();
        setAllValidPaused(false);
      }
      allValidAbortRef.current?.abort();
    }
  }

  /** Pause the streaming run by installing a gate the for-await loop
   *  will wait on before pulling the next chunk. The unpulled chunks
   *  backpressure the server stream, so the server stops paginating
   *  until the admin clicks Resume. Confirm-cancel resolves the gate
   *  too (by aborting the controller) so a paused run can still be
   *  cancelled cleanly. */
  function pauseAllValidCsv() {
    if (pauseGateRef.current || allValidCancelRef.current) return;
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    pauseGateRef.current = { promise, resolve };
    setAllValidPaused(true);
    setAllValidProgress((p) => (p ? { ...p, phase: "paused", etaSeconds: null } : p));
  }

  function resumeAllValidCsv() {
    const gate = pauseGateRef.current;
    if (!gate) return;
    pauseGateRef.current = null;
    (gate as PauseGate).resolve();
    setAllValidPaused(false);
    setAllValidProgress((p) => (p && p.phase === "paused" ? { ...p, phase: "fetching" } : p));
  }

  function dismissAllValidProgress() {
    setAllValidProgress(null);
  }

  // Codebook scope (survey + language) is persisted to localStorage so an
  // admin who consistently exports e.g. "phase-1" + Sinhala-only doesn't
  // have to re-pick those filters on every page refresh. Storage key is
  // versioned (`v1`) so we can evolve the shape later without dirty reads.
  const CODEBOOK_PREFS_KEY = "eip-insight:admin:codebook:v1";
  type CodebookPrefs = {
    survey: string;
    lang: "__all__" | "en" | "si" | "ta";
    perLanguageSheets: boolean;
  };
  function loadCodebookPrefs(): CodebookPrefs {
    const fallback: CodebookPrefs = {
      survey: "__all__",
      lang: "__all__",
      perLanguageSheets: false,
    };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(CODEBOOK_PREFS_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<CodebookPrefs>;
      const survey =
        typeof parsed.survey === "string" && (parsed.survey === "__all__" || SURVEYS[parsed.survey])
          ? parsed.survey
          : "__all__";
      const lang =
        parsed.lang === "en" ||
        parsed.lang === "si" ||
        parsed.lang === "ta" ||
        parsed.lang === "__all__"
          ? parsed.lang
          : "__all__";
      const perLanguageSheets = parsed.perLanguageSheets === true;
      return { survey, lang, perLanguageSheets };
    } catch {
      return fallback;
    }
  }
  const [codebookSurvey, setCodebookSurvey] = useState<string>(() => loadCodebookPrefs().survey);
  const [codebookLang, setCodebookLang] = useState<"__all__" | "en" | "si" | "ta">(
    () => loadCodebookPrefs().lang,
  );
  const [codebookPerLanguageSheets, setCodebookPerLanguageSheets] = useState<boolean>(
    () => loadCodebookPrefs().perLanguageSheets,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        CODEBOOK_PREFS_KEY,
        JSON.stringify({
          survey: codebookSurvey,
          lang: codebookLang,
          perLanguageSheets: codebookPerLanguageSheets,
        }),
      );
    } catch {
      // localStorage may be unavailable (Safari private mode, quota); the
      // UI keeps working with in-memory state, just without persistence.
    }
  }, [codebookSurvey, codebookLang, codebookPerLanguageSheets]);

  // Live preview of the exact header row the codebook CSV will emit for
  // the current language filter. Pure projection of `buildCodebookHeaders`
  // so it stays byte-equivalent with the downloaded file. "__all__"
  // includes EN+SI+TA columns; a single-language pick drops the other
  // two label columns from the header.
  const codebookHeaderLangs: readonly CodebookLang[] =
    codebookLang === "__all__" ? (["en", "si", "ta"] as const) : [codebookLang];
  const codebookHeaderPreview = buildCodebookHeaders(codebookHeaderLangs);

  // Visual analytics chart language. Tracks the codebook language picker
  // so the dashboard charts speak the same language as the export the
  // admin is about to download. "__all__" falls back to English (the
  // canonical export label language).
  const chartLang: "en" | "si" | "ta" = codebookLang === "__all__" ? "en" : codebookLang;

  async function downloadCodebookCsv() {
    setExporting("__codebook__");
    try {
      const payload: { surveySlug?: string; langs?: ("en" | "si" | "ta")[] } = {};
      if (codebookSurvey !== "__all__") payload.surveySlug = codebookSurvey;
      if (codebookLang !== "__all__") payload.langs = [codebookLang];
      const { csv, filename, questionCount, optionCount, surveyCount } = await exportCodebookFn({
        data: Object.keys(payload).length ? payload : undefined,
      });
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Codebook: ${surveyCount} survey${surveyCount === 1 ? "" : "s"}, ${questionCount} questions, ${optionCount} options`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  async function downloadCodebookXlsx() {
    setExporting("__codebook_xlsx__");
    const scopeLabel = codebookSurvey === "__all__" ? "All surveys" : codebookSurvey;
    const langLabel =
      codebookLang === "__all__"
        ? "EN+SI+TA"
        : ({ en: "English", si: "Sinhala", ta: "Tamil" } as const)[codebookLang];
    const sheetModeLabel = codebookPerLanguageSheets ? "per-language sheets" : "merged sheet";
    try {
      const payload: {
        surveySlug?: string;
        langs?: ("en" | "si" | "ta")[];
        perLanguageSheets?: boolean;
      } = {};
      if (codebookSurvey !== "__all__") payload.surveySlug = codebookSurvey;
      if (codebookLang !== "__all__") payload.langs = [codebookLang];
      if (codebookPerLanguageSheets) payload.perLanguageSheets = true;
      const { base64, filename, questionCount, optionCount, surveyCount, sheetNames, cacheHit } =
        await exportCodebookXlsxFn({
          data: Object.keys(payload).length ? payload : undefined,
        });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const sheets = sheetNames?.join(", ") ?? "Codebook";
      toast.success(`Codebook XLSX downloaded: ${filename}`, {
        description:
          `Scope: ${scopeLabel} · Language: ${langLabel} · ${sheetModeLabel} (${sheets}) · ` +
          `${surveyCount} survey${surveyCount === 1 ? "" : "s"}, ` +
          `${questionCount} questions, ${optionCount} options` +
          (cacheHit ? " · cached" : ""),
      });
    } catch (e) {
      toast.error(`Codebook XLSX failed for ${scopeLabel} (${langLabel}, ${sheetModeLabel})`, {
        description: (e as Error).message,
      });
    } finally {
      setExporting(null);
    }
  }
  async function downloadZipBundle() {
    if (fFrom && fTo && fFrom > fTo) {
      toast.error("Start date must be on or before end date.");
      return;
    }
    setExporting("__zip__");
    setZipProgress({
      phase: "preparing",
      surveyCount: null,
      totalRows: null,
      filename: null,
    });
    try {
      // Mirror the filtered-export payload so the bundle reflects the
      // operator's current dashboard filters (survey, language, date
      // range, status / validOnly) instead of always exporting every
      // completed response.
      const payload: Parameters<typeof exportZipFn>[0]["data"] = {
        statusFilter: effectiveStatus,
        validOnly: fValidOnly,
        dateField: fDateField,
      };
      if (fSurvey !== "__all__") payload.surveySlug = fSurvey;
      if (fLang !== "__all__") payload.language = fLang as "en" | "si" | "ta";
      if (fFrom) payload.dateFrom = fFrom;
      if (fTo) payload.dateTo = fTo;
      const { files, filename, surveyCount, totalRows } = await exportZipFn({
        data: payload,
      });
      // Phase 2: stream the ZIP via fflate's chunked `Zip` writer.
      // `zipSync` would buffer the entire compressed archive as one
      // contiguous Uint8Array AND keep all source CSV strings live in
      // the `files` array — peak memory ≈ 2× the bundle size. Instead,
      // we feed each per-survey CSV into an `AsyncZipDeflate` (deflate
      // runs off-main-thread in a worker), append the emitted chunks to
      // a `Uint8Array[]`, and drop the source CSV string after it's been
      // encoded so the GC can reclaim it before the next file is added.
      // The final Blob is built from the chunk array — Blobs hold the
      // backing buffers without re-copying them, and large blobs may be
      // spilled to disk by the browser, so peak JS-heap usage stays
      // proportional to one file at a time rather than the whole bundle.
      setZipProgress({
        phase: "zipping",
        surveyCount,
        totalRows,
        filename,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const chunks: Uint8Array[] = [];
      const zipDone = new Promise<void>((resolve, reject) => {
        const zip = new Zip((err, chunk, final) => {
          if (err) {
            reject(err);
            return;
          }
          if (chunk && chunk.length) chunks.push(chunk);
          if (final) resolve();
        });
        // Pipe each file through async deflate so compression doesn't
        // block the UI thread. We push entries sequentially and `await
        // setTimeout(0)` between them so React can paint the in-progress
        // frame and the GC can run between large entries.
        (async () => {
          try {
            for (let i = 0; i < files.length; i += 1) {
              const f = files[i];
              const entry = new AsyncZipDeflate(f.name, { level: 6 });
              zip.add(entry);
              const bytes = strToU8(f.csv);
              // Drop the in-memory CSV string so it can be GC'd before
              // we move on to the next entry. This is the main heap
              // savings on large bundles — without it, every per-survey
              // CSV stayed pinned in `files` until the entire archive
              // was assembled.
              files[i] = { name: f.name, csv: "" };
              entry.push(bytes, true);
              await new Promise((r) => setTimeout(r, 0));
            }
            zip.end();
          } catch (e) {
            reject(e);
          }
        })();
      });
      await zipDone;
      // Phase 3: blob + download trigger. Same yield trick so the final
      // 100% frame paints before the save dialog steals focus.
      setZipProgress({
        phase: "downloading",
        surveyCount,
        totalRows,
        filename,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Bundled ${surveyCount} survey${surveyCount === 1 ? "" : "s"} (${totalRows.toLocaleString()} rows)`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
      setZipProgress(null);
    }
  }

  async function downloadFilteredCsv() {
    if (fFrom && fTo && fFrom > fTo) {
      toast.error("Start date must be on or before end date.");
      return;
    }
    setExporting("__filtered__");
    const abortController = new AbortController();
    filteredAbortRef.current = abortController;
    setFilteredCancelling(false);
    try {
      const payload: Parameters<typeof exportFilteredFn>[0]["data"] = {
        statusFilter: effectiveStatus,
        validOnly: fValidOnly,
        dateField: fDateField,
      };
      if (fSurvey !== "__all__") payload.surveySlug = fSurvey;
      if (fLang !== "__all__") payload.language = fLang as "en" | "si" | "ta";
      if (fFrom) payload.dateFrom = fFrom;
      if (fTo) payload.dateTo = fTo;
      const { csv, filename, rowCount, droppedInvalid, droppedUnknownSurvey } =
        await exportFilteredFn({ data: payload, signal: abortController.signal });
      // If the admin clicked Cancel between the response landing and us
      // assembling the Blob, honor it: don't trigger the download.
      if (abortController.signal.aborted) {
        toast.info("Filtered export cancelled");
        return;
      }
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const dInvalid = droppedInvalid ?? 0;
      const dUnknown = droppedUnknownSurvey ?? 0;
      const parts: string[] = [];
      if (fValidOnly && dInvalid > 0) parts.push(`${dInvalid} invalid`);
      if (fValidOnly && dUnknown > 0) parts.push(`${dUnknown} unknown survey`);
      const suffix = parts.length > 0 ? ` (dropped ${parts.join(", ")})` : "";
      toast.success(`Exported ${rowCount} response${rowCount === 1 ? "" : "s"}${suffix}`);
    } catch (e) {
      if (abortController.signal.aborted) {
        toast.info("Filtered export cancelled");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setExporting(null);
      setFilteredCancelling(false);
      filteredAbortRef.current = null;
    }
  }

  async function downloadFilteredXlsx() {
    if (fFrom && fTo && fFrom > fTo) {
      toast.error("Start date must be on or before end date.");
      return;
    }
    setExporting("__filtered_xlsx__");
    const abortController = new AbortController();
    filteredAbortRef.current = abortController;
    setFilteredCancelling(false);
    try {
      const payload: Parameters<typeof exportFilteredXlsxFn>[0]["data"] = {
        statusFilter: effectiveStatus,
        validOnly: fValidOnly,
        dateField: fDateField,
      };
      if (fSurvey !== "__all__") payload.surveySlug = fSurvey;
      if (fLang !== "__all__") payload.language = fLang as "en" | "si" | "ta";
      if (fFrom) payload.dateFrom = fFrom;
      if (fTo) payload.dateTo = fTo;
      const { base64, filename, rowCount, droppedInvalid, droppedUnknownSurvey } =
        await exportFilteredXlsxFn({ data: payload, signal: abortController.signal });
      if (abortController.signal.aborted) {
        toast.info("Filtered export cancelled");
        return;
      }
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const dInvalid = droppedInvalid ?? 0;
      const dUnknown = droppedUnknownSurvey ?? 0;
      const parts: string[] = [];
      if (fValidOnly && dInvalid > 0) parts.push(`${dInvalid} invalid`);
      if (fValidOnly && dUnknown > 0) parts.push(`${dUnknown} unknown survey`);
      const suffix = parts.length > 0 ? ` (dropped ${parts.join(", ")})` : "";
      toast.success(`Exported ${rowCount} response${rowCount === 1 ? "" : "s"}${suffix}`);
    } catch (e) {
      if (abortController.signal.aborted) {
        toast.info("Filtered export cancelled");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setExporting(null);
      setFilteredCancelling(false);
      filteredAbortRef.current = null;
    }
  }

  /** Aborts the in-flight filtered CSV/XLSX export. The server fn is
   *  single-shot (not streaming), so abort either prevents the response
   *  from being assembled into a download or — if the response already
   *  landed — short-circuits the Blob/click step in the success branch. */
  function cancelFilteredExport() {
    const ctrl = filteredAbortRef.current;
    if (ctrl && !ctrl.signal.aborted) {
      setFilteredCancelling(true);
      ctrl.abort();
    }
  }

  const rows = list?.rows ?? [];
  const totalRows = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  // Re-localize the analytics labels client-side so the dashboard charts
  // speak whichever language the codebook export is currently set to.
  // The server-side `getStats` payload always returns the canonical
  // English labels (so the JSON shape stays cache-friendly + locale-
  // independent across users); we re-key by `id` / `slug` here against
  // `SURVEYS` to swap them in. When `chartLang === "en"` this is a no-op
  // pass-through (same identity for surveySplit / questionStats).
  const localizedLangSplit = useMemo(() => {
    if (!stats) return [] as { name: string; value: number }[];
    return stats.langSplit.map((s) => {
      const code = s.name as "en" | "si" | "ta";
      const dict = LANG_LABELS[code];
      return { name: dict ? pickText(dict, chartLang) : s.name, value: s.value };
    });
  }, [stats, chartLang]);
  const localizedSurveySplit = useMemo(() => {
    if (!stats) return [] as { name: string; value: number }[];
    return stats.surveySplit.map((s) => {
      const sv = SURVEYS[s.name];
      return { name: sv ? pickText(sv.title, chartLang) : s.name, value: s.value };
    });
  }, [stats, chartLang]);
  const localizedQuestionStats = useMemo(() => {
    if (!stats || !SURVEYS[slug]) return stats?.questionStats ?? [];
    const survey = SURVEYS[slug];
    const byId = new Map(survey.questions.map((q) => [q.id, q]));
    return stats.questionStats.map((q) => {
      const qq = byId.get(q.id);
      if (!qq) return q;
      return {
        ...q,
        label: pickText(qq.label, chartLang),
        section: pickText(qq.section, chartLang),
      };
    });
  }, [stats, slug, chartLang]);
  const localizedSectionStats = useMemo(() => {
    if (!stats || !SURVEYS[slug]) return stats?.sectionStats ?? [];
    const survey = SURVEYS[slug];
    // The server keys sections by whichever language the respondent took
    // the survey in (see `sectionBreakdown(survey, answers, lang)` in
    // `getStats`), so the same section can show up under multiple keys.
    // Build an EN→{si,ta} map from the survey definition and re-bucket
    // any incoming key whose EN form we recognize. Unknown keys pass
    // through untouched.
    const enToLocal = new Map<string, string>();
    for (const q of survey.questions) {
      const en = pickText(q.section, "en");
      enToLocal.set(en, pickText(q.section, chartLang));
    }
    return stats.sectionStats.map((s) => ({
      ...s,
      name: enToLocal.get(s.name) ?? s.name,
    }));
  }, [stats, slug, chartLang]);

  // Reset alerts + baseline whenever the admin switches survey scope —
  // mixing snapshots across surveys would diff incomparable denominators.
  useEffect(() => {
    prevSnapshotRef.current = null;
    setAlerts([]);
    setDismissedIds(new Set());
  }, [slug]);

  // Detect alerts on every stats refresh. Runs after polling / realtime
  // pushes new data into `stats` + `localizedQuestionStats`.
  useEffect(() => {
    if (!stats) return;
    const cur: AlertSnapshot = {
      surveySlug: slug,
      total: stats.total,
      completionRate: stats.completionRate,
      questions: localizedQuestionStats.map((q) => ({
        id: q.id,
        label: q.label,
        answeredPct: q.answeredPct,
        total: q.total,
      })),
    };
    const fresh = detectAlerts(prevSnapshotRef.current, cur);
    prevSnapshotRef.current = cur;
    if (fresh.length === 0) return;
    setAlerts((prev) => {
      const next = [...fresh, ...prev].slice(0, 20);
      return next;
    });
    for (const a of fresh) {
      if (a.kind === "completion_drop") {
        toast.warning(`Completion rate dropped ${a.deltaPp}pp (${a.prevPct}% → ${a.curPct}%)`);
      } else {
        toast.warning(`Skip spike on “${a.questionLabel}”`);
      }
    }
  }, [stats, localizedQuestionStats, slug]);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissedIds.has(a.id)),
    [alerts, dismissedIds],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Auto-prompt: shown once on mount when a previous failed CSV/XLSX
          export was hydrated from localStorage, so a refresh doesn't
          require the admin to scroll for the resume banner. */}
      <AlertDialog open={resumePromptOpen} onOpenChange={setResumePromptOpen}>
        <AlertDialogContent data-testid="resume-prompt-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Resume your last export?</AlertDialogTitle>
            <AlertDialogDescription>
              {resumePrompts.length === 1
                ? "A previous streaming export failed before it finished. Its buffered pages are still saved in this browser — you can pick up where it left off."
                : "Previous streaming exports failed before they finished. Their buffered pages are still saved in this browser — you can pick up where each one left off."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2 text-sm">
            {resumePrompts.map((p) => (
              <li
                key={p.kind}
                className="rounded-md border bg-muted/40 p-2"
                data-testid={`resume-prompt-row-${p.kind}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium uppercase">{p.kind}</span>
                  <Button
                    size="sm"
                    variant="default"
                    data-testid={`resume-prompt-resume-${p.kind}`}
                    onClick={() => {
                      setResumePromptOpen(false);
                      if (p.kind === "csv") resumeAllValidCsvFromLastPage();
                      else resumeAllValidXlsxFromLastPage();
                    }}
                  >
                    Resume from page {p.lastPage + 1}
                  </Button>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Buffered{" "}
                  <span className="font-medium text-foreground">{p.rowCount.toLocaleString()}</span>{" "}
                  row{p.rowCount === 1 ? "" : "s"} through page{" "}
                  <span className="font-medium text-foreground">{p.lastPage}</span>.
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-mono">requestId={p.requestId}</span>
                </div>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="resume-prompt-later">Decide later</AlertDialogCancel>
            <AlertDialogAction
              data-testid="resume-prompt-discard-all"
              onClick={() => {
                for (const p of resumePrompts) {
                  if (p.kind === "csv") {
                    clearCsvResume();
                    partialBufferRef.current = null;
                    setFailedRun(null);
                  } else {
                    clearXlsxResume();
                    xlsxPartialBufferRef.current = null;
                    setXlsxFailedRun(null);
                  }
                }
                setResumePrompts([]);
                setResumePromptOpen(false);
              }}
            >
              Discard saved runs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">EIP Insight</p>
            <h1 className="text-base font-semibold">Admin dashboard</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{email}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Sign out"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Tabs value={slug} onValueChange={setSlug}>
          <TabsList>
            <TabsTrigger value="__all__">All surveys</TabsTrigger>
            {SURVEY_LIST.map((s) => (
              <TabsTrigger key={s.slug} value={s.slug}>
                {pickText(s.title, lang)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card title="Cohort filters">
          <p className="mb-3 text-xs text-muted-foreground">
            Filter the dashboard stats and response list to compare cohorts. The survey tab above
            acts as the questionnaire version selector.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="cohort-lang" className="text-xs">
                Language
              </Label>
              <select
                id="cohort-lang"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={cohortLang}
                onChange={(e) => setCohortLang(e.target.value)}
              >
                <option value="__all__">All languages</option>
                <option value="en">English</option>
                <option value="si">Sinhala</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cohort-from" className="text-xs">
                From (started)
              </Label>
              <Input
                id="cohort-from"
                type="date"
                value={cohortFrom}
                max={cohortTo || undefined}
                onChange={(e) => setCohortFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cohort-to" className="text-xs">
                To (started)
              </Label>
              <Input
                id="cohort-to"
                type="date"
                value={cohortTo}
                min={cohortFrom || undefined}
                onChange={(e) => setCohortTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={cohortLang === "__all__" && !cohortFrom && !cohortTo}
                onClick={() => {
                  setCohortLang("__all__");
                  setCohortFrom("");
                  setCohortTo("");
                }}
              >
                Clear cohort
              </Button>
            </div>
          </div>
          {!cohortDatesValid && (
            <p className="mt-2 text-xs text-destructive">"From" must be on or before "To".</p>
          )}
        </Card>

        {loading || !stats ? (
          <div className="space-y-6 animate-fade-in" aria-busy="true" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-8 w-20" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Responses over time">
                <LineChartSkeleton />
              </Card>
              <Card title="By language">
                <PieChartSkeleton />
              </Card>
              <Card title="By survey">
                <BarChartSkeleton />
              </Card>
              <Card title="Completion rate">
                <div className="grid h-[240px] place-items-center">
                  <Skeleton className="h-16 w-32" />
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <>
            <LiveStatusPill
              live={live}
              refreshing={refreshing}
              updatedAt={updatedAt}
              onToggle={setLive}
              onRefreshNow={() => loadStats({ background: true })}
            />
            <AlertsPanel
              alerts={visibleAlerts}
              onDismiss={(id) =>
                setDismissedIds((prev) => {
                  const next = new Set(prev);
                  next.add(id);
                  return next;
                })
              }
              onClearAll={() =>
                setDismissedIds((prev) => {
                  const next = new Set(prev);
                  for (const a of visibleAlerts) next.add(a.id);
                  return next;
                })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total responses" value={stats.total} />
              <Stat label="Completed" value={stats.completed} accent />
              <Stat label="In progress" value={stats.inProgress} />
              <Stat label="Avg time (min)" value={stats.avgMinutes} />
            </div>

            <Card title="Download analytics report">
              <AnalyticsReportPanel surveySlug={slug !== "__all__" ? slug : undefined} />
            </Card>

            <div
              className="grid gap-4 lg:grid-cols-2 animate-fade-in"
              aria-busy={refreshing ? "true" : "false"}
            >
              <Card title="Responses over time">
                <Suspense fallback={<LineChartSkeleton />}>
                  <DashboardCharts.Daily data={stats.daily} />
                </Suspense>
              </Card>

              <Card title="By language">
                <Suspense fallback={<PieChartSkeleton />}>
                  <DashboardCharts.Lang data={localizedLangSplit} />
                </Suspense>
              </Card>

              <Card title="By survey">
                <Suspense fallback={<BarChartSkeleton />}>
                  <DashboardCharts.Survey data={localizedSurveySplit} />
                </Suspense>
              </Card>

              <Card title="Completion rate">
                <div className="flex h-[240px] flex-col items-center justify-center gap-2 animate-scale-in">
                  <div className="text-6xl font-semibold gradient-eco bg-clip-text text-transparent">
                    {stats.completionRate}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {stats.completed} of {stats.total} completed
                  </p>
                </div>
              </Card>
            </div>

            {slug !== "__all__" && localizedSectionStats.length > 0 && (
              <Card title="Section completion">
                <div className="space-y-3">
                  {localizedSectionStats.map((s) => (
                    <div key={s.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">
                          {s.pct}% &middot; {s.done}/{s.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {slug !== "__all__" &&
              localizedQuestionStats.length > 0 &&
              (() => {
                const answered = localizedQuestionStats.reduce((s, q) => s + q.answered, 0);
                const possible = localizedQuestionStats.reduce((s, q) => s + q.total, 0);
                const skipped = Math.max(0, possible - answered);
                const answeredPct = possible ? Math.round((answered / possible) * 100) : 0;
                const skippedPct = possible ? 100 - answeredPct : 0;
                const chartData = localizedQuestionStats.map((q) => ({
                  id: q.id,
                  label: q.label,
                  answeredPct: q.answeredPct,
                }));
                // Richer dataset used by the drop-off drilldown so the
                // dialog can render exact counts + the top-N selected
                // answers in the dashboard's current language.
                const dropoffData = localizedQuestionStats.map((q) => ({
                  id: q.id,
                  label: q.label,
                  section: q.section,
                  type: q.type,
                  answered: q.answered,
                  total: q.total,
                  answeredPct: q.answeredPct,
                  distribution: q.distribution,
                }));
                // Pre-compute drop-off so the drilldown can show the same
                // % the chart bar represents without recomputing.
                const dropoffRows = computeDropoff(dropoffData).rows;
                const selectedDrilldown: QuestionDrilldownData | null = (() => {
                  if (!dropoffSelectedId) return null;
                  const q = dropoffData.find((d) => d.id === dropoffSelectedId);
                  if (!q) return null;
                  const r = dropoffRows.find((rr) => rr.id === dropoffSelectedId);
                  return { ...q, dropPct: r?.dropPct ?? 0 };
                })();
                return (
                  <Card title="Progress analytics">
                    <p className="mb-4 text-xs text-muted-foreground">
                      Aggregate completion across {localizedQuestionStats.length} questions ×{" "}
                      {stats.total} {stats.total === 1 ? "respondent" : "respondents"}.
                    </p>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Stat label="Completion rate" value={`${stats.completionRate}%`} accent />
                      <Stat label="Selected (answers)" value={answered.toLocaleString()} />
                      <Stat label="Skipped" value={skipped.toLocaleString()} />
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Selected vs skipped — {answeredPct}% selected, {skippedPct}% skipped
                      </p>
                      <Suspense fallback={<StackedBarSkeleton />}>
                        <DashboardCharts.AnsweredSkipped answered={answered} skipped={skipped} />
                      </Suspense>
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Question-by-question completion
                      </p>
                      <Suspense
                        fallback={<HBarListSkeleton rows={Math.min(chartData.length || 6, 8)} />}
                      >
                        <DashboardCharts.QuestionCompletion data={chartData} />
                      </Suspense>
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Drop-off per question — percentage-point loss vs. the previous question. The
                        highlighted bar marks the steepest drop, which usually points to a confusing
                        or burdensome question worth reviewing. Tap a bar (or a row below) to drill
                        into response counts and the top selected answers.
                      </p>
                      <Suspense
                        fallback={<HBarListSkeleton rows={Math.min(dropoffData.length || 6, 8)} />}
                      >
                        <DashboardCharts.Dropoff
                          data={dropoffData}
                          selectedId={dropoffSelectedId}
                          onSelect={(id) => setDropoffSelectedId(id)}
                        />
                      </Suspense>
                    </div>
                    <QuestionDropoffDrilldown
                      open={!!dropoffSelectedId}
                      onOpenChange={(o) => {
                        if (!o) setDropoffSelectedId(null);
                      }}
                      question={selectedDrilldown}
                    />
                  </Card>
                );
              })()}

            {slug !== "__all__" && localizedQuestionStats.length > 0 && (
              <Card title="Question-level stats">
                <p className="mb-3 text-xs text-muted-foreground">
                  Answered rate per question across {stats.total} responses. Distribution shown for
                  choice and Likert questions.
                </p>
                <ul className="space-y-5">
                  {localizedQuestionStats.map((q) => {
                    const maxDist = q.distribution
                      ? Math.max(...q.distribution.map((d) => d.value), 1)
                      : 1;
                    return (
                      <li key={q.id} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" title={q.label}>
                              {q.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {q.section} &middot; {q.type}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {q.answeredPct}% &middot; {q.answered}/{q.total}
                          </span>
                        </div>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={q.answeredPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Answered rate for ${q.label}`}
                        >
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${q.answeredPct}%` }}
                          />
                        </div>
                        {q.distribution && q.distribution.length > 0 && (
                          <ul className="mt-2 space-y-1.5 pl-1">
                            {q.distribution.map((d) => (
                              <li
                                key={d.name}
                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)_auto] items-center gap-2 text-xs"
                              >
                                <span className="truncate text-muted-foreground" title={d.name}>
                                  {d.name}
                                </span>
                                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                                  <span
                                    className="block h-full rounded-full bg-secondary"
                                    style={{ width: `${(d.value / maxDist) * 100}%` }}
                                  />
                                </span>
                                <span className="tabular-nums text-muted-foreground">
                                  {d.value}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <Card title="Filtered export">
              <p className="mb-3 text-xs text-muted-foreground">
                Narrow the CSV by survey, language, started-at date range, and/or status. Same
                multilingual column layout as the full export — decode value codes with the
                codebook.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label htmlFor="f-survey" className="text-xs">
                    Survey
                  </Label>
                  <select
                    id="f-survey"
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={fSurvey}
                    onChange={(e) => setFSurvey(e.target.value)}
                  >
                    <option value="__all__">All surveys</option>
                    {SURVEY_LIST.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.slug}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="f-lang" className="text-xs">
                    Language
                  </Label>
                  <select
                    id="f-lang"
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={fLang}
                    onChange={(e) => setFLang(e.target.value)}
                  >
                    <option value="__all__">All languages</option>
                    <option value="en">English</option>
                    <option value="si">Sinhala</option>
                    <option value="ta">Tamil</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="f-date-field" className="text-xs">
                    Date field
                  </Label>
                  <select
                    id="f-date-field"
                    className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={fDateField}
                    onChange={(e) => setFDateField(e.target.value as "started_at" | "completed_at")}
                    title="Which timestamp the date range filters by"
                  >
                    <option value="started_at">Started at</option>
                    <option value="completed_at">Completed at</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="f-from" className="text-xs">
                    {fDateField === "completed_at" ? "Completed from" : "Started from"}
                  </Label>
                  <Input
                    id="f-from"
                    type="date"
                    className="mt-1 h-9"
                    value={fFrom}
                    max={fTo || undefined}
                    onChange={(e) => setFFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="f-to" className="text-xs">
                    {fDateField === "completed_at" ? "Completed to" : "Started to"}
                  </Label>
                  <Input
                    id="f-to"
                    type="date"
                    className="mt-1 h-9"
                    value={fTo}
                    min={fFrom || undefined}
                    onChange={(e) => setFTo(e.target.value)}
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <div>
                    <Label htmlFor="f-status" className="text-xs">
                      Status
                    </Label>
                    <select
                      id="f-status"
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60"
                      value={effectiveStatus}
                      disabled={fValidOnly}
                      title={
                        fValidOnly
                          ? "Valid only requires Completed responses."
                          : "Filter responses by submission status."
                      }
                      onChange={(e) => setFStatus(e.target.value as StatusFilter)}
                    >
                      <option value="completed">Completed only</option>
                      <option value="in_progress">In-progress only</option>
                      <option value="all">All (completed + in-progress)</option>
                    </select>
                  </div>
                  <label
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                    title="Drop responses missing any required answer (implies Completed only)"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={fValidOnly}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setFValidOnly(next);
                        if (next) setFStatus("completed");
                      }}
                    />
                    Valid only (all required answered)
                  </label>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (fFrom && fTo && fFrom > fTo) {
                        toast.error("Start date must be on or before end date.");
                        return;
                      }
                      setConfirmCsvOpen(true);
                    }}
                    disabled={exporting === "__filtered__" || exporting === "__filtered_xlsx__"}
                  >
                    {exporting === "__filtered__" ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1 size-3.5" />
                    )}
                    Export filtered (CSV)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadFilteredXlsx}
                    disabled={exporting === "__filtered__" || exporting === "__filtered_xlsx__"}
                    title="Same rows as the CSV export, delivered as an .xlsx workbook"
                  >
                    {exporting === "__filtered_xlsx__" ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1 size-3.5" />
                    )}
                    Export filtered (XLSX)
                  </Button>
                  {(exporting === "__filtered__" || exporting === "__filtered_xlsx__") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelFilteredExport}
                      disabled={filteredCancelling}
                      title="Stop the in-progress filtered export. No file will be downloaded."
                      data-testid="filtered-export-cancel"
                    >
                      {filteredCancelling ? "Cancelling…" : "Cancel"}
                    </Button>
                  )}
                </div>
              </div>
              <div
                className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
                role="status"
              >
                {previewError ? (
                  <span className="text-destructive">{previewError}</span>
                ) : previewLoading && !preview ? (
                  <>
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    <span>Counting matches…</span>
                  </>
                ) : preview ? (
                  <span>
                    {previewLoading && (
                      <Loader2
                        className="mr-1 inline size-3 animate-spin align-[-2px]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-medium text-foreground">
                      {preview.matched.toLocaleString()}
                    </span>{" "}
                    response{preview.matched === 1 ? "" : "s"} match the current filters
                    {fValidOnly && preview.droppedInvalid + preview.droppedUnknownSurvey > 0 && (
                      <>
                        {" "}
                        <span className="text-muted-foreground">
                          (
                          {(preview.droppedInvalid + preview.droppedUnknownSurvey).toLocaleString()}{" "}
                          dropped as invalid)
                        </span>
                      </>
                    )}
                    {preview.matched > 0 && (
                      <FilteredByStatusChips byStatus={preview.byStatus} total={preview.matched} />
                    )}
                  </span>
                ) : null}
              </div>
              {preview && preview.bySurvey.length > 0 && (
                <FilteredBySurveyChips
                  bySurvey={preview.bySurvey}
                  total={preview.matched}
                  truncated={preview.breakdownTruncated}
                  lang={lang}
                />
              )}
              {preview && preview.timeseriesAvailable && preview.byDay.length > 0 && (
                <FilteredDailyChart byDay={preview.byDay} dateField={fDateField} />
              )}
              {preview && preview.sample.length > 0 && (
                <FilteredSampleTable sample={preview.sample} lang={lang} />
              )}
              {(fSurvey !== "__all__" ||
                fLang !== "__all__" ||
                fFrom ||
                fTo ||
                fStatus !== "completed" ||
                fValidOnly ||
                fDateField !== "started_at") && (
                <button
                  type="button"
                  className="mt-3 text-xs text-muted-foreground underline"
                  onClick={() => {
                    setFSurvey("__all__");
                    setFLang("__all__");
                    setFFrom("");
                    setFTo("");
                    setFStatus("completed");
                    setFValidOnly(false);
                    setFDateField("started_at");
                  }}
                >
                  Reset filters
                </button>
              )}
              <AlertDialog open={confirmCsvOpen} onOpenChange={setConfirmCsvOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Export filtered responses (CSV)?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-foreground">
                            {(preview?.matched ?? 0).toLocaleString()}
                          </span>{" "}
                          response{(preview?.matched ?? 0) === 1 ? "" : "s"} will be exported.
                        </div>
                        {fValidOnly && (
                          <ul className="list-disc pl-5 text-muted-foreground">
                            <li>
                              Dropped invalid:{" "}
                              <span className="font-medium text-foreground">
                                {(preview?.droppedInvalid ?? 0).toLocaleString()}
                              </span>
                            </li>
                            <li>
                              Dropped unknown survey:{" "}
                              <span className="font-medium text-foreground">
                                {(preview?.droppedUnknownSurvey ?? 0).toLocaleString()}
                              </span>
                            </li>
                          </ul>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setConfirmCsvOpen(false);
                        void downloadFilteredCsv();
                      }}
                    >
                      Download CSV
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>

            <Card
              title="Recent responses"
              right={
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={exporting === "__all_valid__"}
                    onClick={() => void downloadAllValidCsv()}
                    title="All completed responses across every survey, with multilingual question metadata embedded in the header row."
                    aria-describedby={allValidProgress ? "all-valid-progress" : undefined}
                  >
                    {exporting === "__all_valid__" ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1 size-3.5" />
                    )}
                    {exporting === "__all_valid__" && allValidProgress
                      ? allValidProgress.phase === "starting"
                        ? "Preparing export…"
                        : allValidProgress.phase === "paused"
                          ? `Paused at ${allValidProgress.processed.toLocaleString()}${allValidProgress.total ? ` / ${allValidProgress.total.toLocaleString()}` : ""}`
                          : allValidProgress.phase === "finalizing"
                            ? "Finalizing…"
                            : `Streaming ${allValidProgress.processed.toLocaleString()}${allValidProgress.total ? ` / ${allValidProgress.total.toLocaleString()}` : ""}…`
                      : "All valid responses (CSV)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={exporting === "__all_valid_xlsx__"}
                    onClick={() => void downloadAllValidXlsx()}
                    title="Streaming all-valid XLSX export. On a transient failure, the workbook can be resumed from the last successfully streamed page."
                    data-testid="all-valid-xlsx-button"
                  >
                    {exporting === "__all_valid_xlsx__" ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1 size-3.5" />
                    )}
                    {exporting === "__all_valid_xlsx__" && xlsxAllValidProgress
                      ? xlsxAllValidProgress.phase === "starting"
                        ? "Preparing XLSX…"
                        : xlsxAllValidProgress.phase === "resuming"
                          ? `Resuming XLSX from page ${xlsxAllValidProgress.resumeFromPage ?? "?"}…`
                          : xlsxAllValidProgress.phase === "finalizing"
                            ? "Finalizing XLSX…"
                            : `Streaming ${xlsxAllValidProgress.processed.toLocaleString()}${xlsxAllValidProgress.total ? ` / ${xlsxAllValidProgress.total.toLocaleString()}` : ""}…`
                      : "All valid responses (XLSX)"}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Tune retry/backoff for the streaming XLSX (and CSV) export."
                        data-testid="stream-retry-settings"
                      >
                        <Settings2 className="mr-1 size-3.5" />
                        Retry settings
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium">Stream retry / backoff</h4>
                          <p className="text-xs text-muted-foreground">
                            Applied to the streaming XLSX export (and the CSV stream). Higher
                            attempts = more resilient; longer delays = friendlier to a flaky
                            upstream but slower overall.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="retry-max" className="text-xs">
                              Max attempts
                            </Label>
                            <Input
                              id="retry-max"
                              type="number"
                              min={1}
                              max={10}
                              step={1}
                              value={retryPrefs.maxAttempts}
                              onChange={(e) =>
                                setRetryPrefs((p) => ({
                                  ...p,
                                  maxAttempts: clampInt(
                                    Number(e.target.value),
                                    1,
                                    10,
                                    DEFAULT_RETRY.maxAttempts,
                                  ),
                                }))
                              }
                              data-testid="retry-max-attempts"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="retry-base" className="text-xs">
                              Base delay (ms)
                            </Label>
                            <Input
                              id="retry-base"
                              type="number"
                              min={0}
                              max={60000}
                              step={50}
                              value={retryPrefs.baseDelayMs}
                              onChange={(e) =>
                                setRetryPrefs((p) => ({
                                  ...p,
                                  baseDelayMs: clampInt(
                                    Number(e.target.value),
                                    0,
                                    60_000,
                                    DEFAULT_RETRY.baseDelayMs,
                                  ),
                                }))
                              }
                              data-testid="retry-base-delay"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="retry-factor" className="text-xs">
                              Backoff ×
                            </Label>
                            <Input
                              id="retry-factor"
                              type="number"
                              min={1}
                              max={10}
                              step={0.5}
                              value={retryPrefs.backoffFactor}
                              onChange={(e) =>
                                setRetryPrefs((p) => ({
                                  ...p,
                                  backoffFactor: clampNum(
                                    Number(e.target.value),
                                    1,
                                    10,
                                    DEFAULT_RETRY.backoffFactor,
                                  ),
                                }))
                              }
                              data-testid="retry-backoff-factor"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Schedule: attempt N waits{" "}
                          <span className="font-mono">
                            {retryPrefs.baseDelayMs} × {retryPrefs.backoffFactor}
                            <sup>N−1</sup>
                          </span>{" "}
                          ms (jittered server-side). Saved to this browser.
                        </p>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRetryPrefs(DEFAULT_RETRY)}
                            data-testid="retry-reset"
                          >
                            Reset to defaults
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {exporting === "__all_valid_xlsx__" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelAllValidXlsx}
                      data-testid="all-valid-xlsx-cancel"
                    >
                      Cancel XLSX
                    </Button>
                  )}
                  {exporting === "__all_valid__" && (
                    <>
                      {allValidPaused ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resumeAllValidCsv}
                          disabled={allValidCancelling}
                          title="Resume the paused export. The server will continue paginating from where it stopped."
                          data-testid="all-valid-resume-toolbar"
                        >
                          Resume
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={pauseAllValidCsv}
                          disabled={
                            allValidCancelling ||
                            !allValidProgress ||
                            allValidProgress.phase === "starting" ||
                            allValidProgress.phase === "finalizing"
                          }
                          title="Pause the export without cancelling. The server stream is held; you can resume at any time."
                          data-testid="all-valid-pause-toolbar"
                        >
                          Pause
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelAllValidCsv}
                        disabled={allValidCancelling}
                        title="Stop the in-progress export. No file will be downloaded."
                      >
                        {allValidCancelling ? "Cancelling…" : "Cancel"}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={exporting === "__zip__"}
                    aria-describedby={zipProgress ? "zip-bundle-progress" : undefined}
                    onClick={downloadZipBundle}
                    title="ZIP bundle: one CSV per survey honoring the current filters (survey, language, date range, status / valid-only) plus a summary.csv of per-survey counts and language splits and the codebook."
                  >
                    {exporting === "__zip__" ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1 size-3.5" />
                    )}
                    {exporting === "__zip__" && zipProgress
                      ? zipProgress.phase === "preparing"
                        ? "Preparing CSVs…"
                        : zipProgress.phase === "zipping"
                          ? "Zipping…"
                          : "Downloading…"
                      : "Bundle (ZIP)"}
                  </Button>
                  <div className="inline-flex items-stretch overflow-hidden rounded-md border">
                    <select
                      aria-label="Codebook scope"
                      className="h-9 border-r bg-background px-2 text-xs"
                      value={codebookSurvey}
                      onChange={(e) => setCodebookSurvey(e.target.value)}
                      disabled={exporting === "__codebook__"}
                    >
                      <option value="__all__">All surveys</option>
                      {SURVEY_LIST.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.slug}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Codebook languages"
                      className="h-9 border-r bg-background px-2 text-xs"
                      value={codebookLang}
                      onChange={(e) => setCodebookLang(e.target.value as typeof codebookLang)}
                      disabled={exporting === "__codebook__"}
                    >
                      <option value="__all__">All languages (EN+SI+TA)</option>
                      <option value="en">English only</option>
                      <option value="si">Sinhala only</option>
                      <option value="ta">Tamil only</option>
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-none border-0"
                      disabled={exporting === "__codebook__"}
                      onClick={downloadCodebookCsv}
                      title="Codebook: every question and option code with EN/SI/TA labels. Choose a survey to scope the export, or keep 'All surveys' for the full codebook. Join against the value codes in the response CSVs to read answers in any language."
                    >
                      {exporting === "__codebook__" ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1 size-3.5" />
                      )}
                      Codebook (CSV)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-none border-0 border-l"
                      disabled={exporting === "__codebook_xlsx__"}
                      onClick={downloadCodebookXlsx}
                      title="Codebook (XLSX): same multilingual codebook as the CSV, delivered as an Excel workbook with a frozen, bolded header row."
                    >
                      {exporting === "__codebook_xlsx__" ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1 size-3.5" />
                      )}
                      Codebook (XLSX)
                    </Button>
                  </div>
                  <label
                    className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                    title="When checked (and a multi-language scope is selected), the XLSX codebook is emitted with one sheet per language (EN/SI/TA) instead of a single merged sheet."
                  >
                    <input
                      type="checkbox"
                      data-testid="codebook-per-language-sheets"
                      checked={codebookPerLanguageSheets}
                      onChange={(e) => setCodebookPerLanguageSheets(e.target.checked)}
                      disabled={exporting === "__codebook_xlsx__" || codebookLang !== "__all__"}
                    />
                    XLSX: separate sheet per language
                  </label>
                  <div
                    data-testid="codebook-header-preview"
                    data-codebook-lang={codebookLang}
                    className="w-full rounded-md border bg-muted/30 p-2 text-xs"
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span>Codebook header preview</span>
                      <span>
                        {codebookHeaderPreview.length} column
                        {codebookHeaderPreview.length === 1 ? "" : "s"} ·{" "}
                        {codebookLang === "__all__" ? "EN+SI+TA" : codebookLang.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {codebookHeaderPreview.map((h) => (
                        <code
                          key={h}
                          data-testid="codebook-header-cell"
                          className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
                        >
                          {h}
                        </code>
                      ))}
                    </div>
                  </div>
                  {SURVEY_LIST.map((s) => (
                    <Button
                      key={s.slug}
                      size="sm"
                      variant="outline"
                      disabled={exporting === s.slug}
                      onClick={() => downloadCsv(s.slug)}
                    >
                      {exporting === s.slug ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1 size-3.5" />
                      )}
                      {s.slug}.csv
                    </Button>
                  ))}
                </div>
              }
            >
              {allValidProgress && (
                <AllValidProgressCard
                  progress={allValidProgress}
                  paused={allValidPaused}
                  onPause={pauseAllValidCsv}
                  onResume={resumeAllValidCsv}
                  onDismiss={
                    allValidProgress.phase === "cancelled" ? dismissAllValidProgress : undefined
                  }
                  onRetryContinuity={
                    allValidProgress.continuityError && failedRun?.canResume
                      ? resumeAllValidCsvFromLastPage
                      : undefined
                  }
                  requestId={currentRequestId}
                />
              )}
              <div
                className="mt-2 rounded-md border bg-muted/20 p-2 text-xs"
                data-testid="all-valid-log-url-settings"
              >
                <Label
                  htmlFor="all-valid-log-url-template"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Logs URL template (optional)
                </Label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input
                    id="all-valid-log-url-template"
                    type="url"
                    inputMode="url"
                    placeholder="https://logs.example.com/search?q={requestId}"
                    value={logUrlDraft}
                    onChange={(e) => setLogUrlDraft(e.target.value)}
                    onBlur={() => persistLogUrlTemplate(logUrlDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        persistLogUrlTemplate(logUrlDraft);
                      }
                    }}
                    className="h-8 flex-1 min-w-[260px] font-mono text-xs"
                    data-testid="all-valid-log-url-template-input"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => persistLogUrlTemplate(logUrlDraft)}
                    data-testid="all-valid-log-url-template-save"
                  >
                    Save
                  </Button>
                  {logUrlTemplate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => persistLogUrlTemplate("")}
                      data-testid="all-valid-log-url-template-clear"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Use <span className="font-mono">{"{requestId}"}</span> as the placeholder. The
                  link appears in toasts and the failure banner whenever a requestId is available.
                  Stored in this browser only.
                </div>
              </div>
              {failedRun && (
                <div
                  data-testid="all-valid-failed-run"
                  role="alert"
                  className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                >
                  <div className="font-medium text-destructive">Streaming export failed</div>
                  <div className="mt-1 text-muted-foreground">{failedRun.error}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {failedRun.canResume ? (
                      <>
                        Buffered{" "}
                        <span className="font-medium text-foreground">
                          {failedRun.rowCount.toLocaleString()}
                        </span>{" "}
                        row{failedRun.rowCount === 1 ? "" : "s"} across{" "}
                        <span className="font-medium text-foreground">
                          {failedRun.lastPage + 1}
                        </span>{" "}
                        page{failedRun.lastPage + 1 === 1 ? "" : "s"} (0–{failedRun.lastPage}).
                        Resume reuses them and continues from page {failedRun.lastPage + 1}.
                      </>
                    ) : (
                      <>No completed pages to resume from.</>
                    )}{" "}
                    <span className="font-mono">requestId={failedRun.requestId}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {failedRun.canResume && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={resumeAllValidCsvFromLastPage}
                        disabled={exporting === "__all_valid__"}
                        data-testid="all-valid-resume-from-last-page"
                      >
                        Resume from last page
                      </Button>
                    )}
                    {failedRun.requestId && failedRun.requestId !== "unknown" && (
                      <CopyRequestIdButton
                        requestId={failedRun.requestId}
                        testId="all-valid-failed-run-copy-request-id"
                      />
                    )}
                    {buildLogUrl(failedRun.requestId, logUrlTemplate) && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        data-testid="all-valid-failed-run-view-logs"
                      >
                        <a
                          href={buildLogUrl(failedRun.requestId, logUrlTemplate)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View logs
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={dismissFailedRun}
                      data-testid="all-valid-failed-run-dismiss"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
              {xlsxAllValidProgress && (
                <div
                  className="mt-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground"
                  data-testid="all-valid-xlsx-progress-strip"
                  data-phase={xlsxAllValidProgress.phase}
                >
                  XLSX export:{" "}
                  {xlsxAllValidProgress.phase === "starting"
                    ? "preparing…"
                    : xlsxAllValidProgress.phase === "restored"
                      ? `restored from refresh — ${xlsxAllValidProgress.processed.toLocaleString()} row${xlsxAllValidProgress.processed === 1 ? "" : "s"} buffered${xlsxAllValidProgress.resumeFromPage != null ? `, resume continues from page ${xlsxAllValidProgress.resumeFromPage}` : ""} (rate/ETA will recompute on resume)`
                      : xlsxAllValidProgress.phase === "resuming"
                        ? `resuming from page ${xlsxAllValidProgress.resumeFromPage ?? "?"} (${xlsxAllValidProgress.processed.toLocaleString()} row${xlsxAllValidProgress.processed === 1 ? "" : "s"} across ${xlsxAllValidProgress.resumeFromPage ?? 0} page${xlsxAllValidProgress.resumeFromPage === 1 ? "" : "s"} reused, recalculating…)`
                        : xlsxAllValidProgress.phase === "finalizing"
                          ? "assembling workbook…"
                          : xlsxAllValidProgress.phase === "cancelled"
                            ? `cancelled at ${xlsxAllValidProgress.processed.toLocaleString()} rows`
                            : `${xlsxAllValidProgress.processed.toLocaleString()} / ${xlsxAllValidProgress.total.toLocaleString()} rows`}
                  {xlsxCurrentRequestId && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] align-middle"
                      data-testid="all-valid-xlsx-progress-request-id"
                      title={`requestId=${xlsxCurrentRequestId} — copy to correlate with server logs`}
                    >
                      <span className="text-foreground/70">req</span>
                      <span>{xlsxCurrentRequestId}</span>
                    </span>
                  )}
                </div>
              )}
              {xlsxFailedRun && (
                <div
                  data-testid="all-valid-xlsx-failed-run"
                  data-exhausted={xlsxFailedRun.exhausted ? "true" : "false"}
                  role="alert"
                  className={
                    "mt-2 rounded-md border p-3 text-sm " +
                    (xlsxFailedRun.exhausted
                      ? "border-destructive bg-destructive/10"
                      : "border-destructive/40 bg-destructive/5")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-destructive">
                      {xlsxFailedRun.exhausted
                        ? `Streaming XLSX export — retries exhausted (${xlsxFailedRun.exhausted.attempts}/${xlsxFailedRun.exhausted.attempts})`
                        : "Streaming XLSX export failed"}
                    </div>
                    {xlsxFailedRun.exhausted && (
                      <span
                        className="rounded-full border border-destructive/60 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive"
                        data-testid="all-valid-xlsx-failed-run-exhausted-badge"
                      >
                        Max attempts reached
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {xlsxFailedRun.exhausted
                      ? xlsxFailedRun.exhausted.lastErrorMessage
                      : xlsxFailedRun.error}
                  </div>
                  {xlsxFailedRun.exhausted && (
                    <div
                      className="mt-2 rounded border border-destructive/30 bg-background/60 p-2 text-xs"
                      data-testid="all-valid-xlsx-failed-run-exhausted-details"
                    >
                      <div className="font-medium text-foreground">
                        Active backoff settings when retries ran out
                      </div>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        <li>
                          Max attempts:{" "}
                          <span className="font-mono text-foreground">
                            {xlsxFailedRun.exhausted.backoff.maxAttempts}
                          </span>
                        </li>
                        <li>
                          Base delay:{" "}
                          <span className="font-mono text-foreground">
                            {xlsxFailedRun.exhausted.backoff.baseDelayMs} ms
                          </span>
                        </li>
                        <li>
                          Backoff factor:{" "}
                          <span className="font-mono text-foreground">
                            ×{xlsxFailedRun.exhausted.backoff.backoffFactor}
                          </span>
                        </li>
                      </ul>
                      <div className="mt-1 text-muted-foreground">
                        Increase max attempts or the base delay below before retrying if the
                        upstream is still flaky.
                      </div>
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {xlsxFailedRun.canResume ? (
                      <>
                        Buffered{" "}
                        <span className="font-medium text-foreground">
                          {xlsxFailedRun.rowCount.toLocaleString()}
                        </span>{" "}
                        row{xlsxFailedRun.rowCount === 1 ? "" : "s"} across{" "}
                        <span className="font-medium text-foreground">
                          {xlsxFailedRun.lastPage + 1}
                        </span>{" "}
                        page{xlsxFailedRun.lastPage + 1 === 1 ? "" : "s"} (0–
                        {xlsxFailedRun.lastPage}). Resume reuses them and continues from page{" "}
                        {xlsxFailedRun.lastPage + 1}.
                      </>
                    ) : (
                      <>No completed pages to resume from.</>
                    )}{" "}
                    <span className="font-mono">requestId={xlsxFailedRun.requestId}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {xlsxFailedRun.canResume && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={resumeAllValidXlsxFromLastPage}
                        disabled={exporting === "__all_valid_xlsx__"}
                        data-testid="all-valid-xlsx-resume-from-last-page"
                      >
                        Resume XLSX from last page
                      </Button>
                    )}
                    {xlsxFailedRun.exhausted && xlsxFailedRun.canResume && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          exporting === "__all_valid_xlsx__" || retryPrefs.maxAttempts >= 10
                        }
                        data-testid="all-valid-xlsx-failed-run-bump-retries"
                        title={
                          retryPrefs.maxAttempts >= 10
                            ? "Already at the 10-attempt cap"
                            : `Bump max attempts to ${Math.min(10, retryPrefs.maxAttempts + 2)} and resume`
                        }
                        onClick={() => {
                          const next = Math.min(10, retryPrefs.maxAttempts + 2);
                          if (next !== retryPrefs.maxAttempts) {
                            setRetryPrefs((prev) => ({ ...prev, maxAttempts: next }));
                            toast.info(`Increased max attempts to ${next} before resuming`);
                          }
                          resumeAllValidXlsxFromLastPage();
                        }}
                      >
                        {retryPrefs.maxAttempts >= 10
                          ? "Resume (retries already maxed)"
                          : `Increase retries to ${Math.min(10, retryPrefs.maxAttempts + 2)} & resume`}
                      </Button>
                    )}
                    {xlsxFailedRun.requestId && xlsxFailedRun.requestId !== "unknown" && (
                      <CopyRequestIdButton
                        requestId={xlsxFailedRun.requestId}
                        testId="all-valid-xlsx-failed-run-copy-request-id"
                      />
                    )}
                    {buildLogUrl(xlsxFailedRun.requestId, logUrlTemplate) && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        data-testid="all-valid-xlsx-failed-run-view-logs"
                      >
                        <a
                          href={buildLogUrl(xlsxFailedRun.requestId, logUrlTemplate)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View logs
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={dismissXlsxFailedRun}
                      data-testid="all-valid-xlsx-failed-run-dismiss"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
              <AlertDialog
                open={confirmCancelAllValidOpen}
                onOpenChange={setConfirmCancelAllValidOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel the export?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The streaming all-valid CSV export is in progress
                      {allValidProgress && allValidProgress.total > 0 ? (
                        <>
                          {" "}
                          ({allValidProgress.processed.toLocaleString()} of{" "}
                          {allValidProgress.total.toLocaleString()} rows fetched).
                        </>
                      ) : (
                        "."
                      )}{" "}
                      Cancelling stops pagination on the server and discards the partial file —
                      nothing will be downloaded.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep exporting</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmCancelAllValidCsv}
                      data-testid="all-valid-cancel-confirm"
                    >
                      Cancel export
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {zipProgress && <ZipBundleProgressCard progress={zipProgress} />}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Started</th>
                      <th>Survey</th>
                      <th>Language</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2">{new Date(r.started_at).toLocaleString()}</td>
                        <td>{r.survey_slug}</td>
                        <td className="uppercase">{r.language}</td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                              r.status === "completed"
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span aria-hidden="true">{r.status === "completed" ? "✓" : "•"}</span>
                            {r.status === "completed" ? "Completed" : "In progress"}
                          </span>
                        </td>
                        <td>{r.progress_pct}%</td>
                        <td>{r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No responses yet —{" "}
                          <Link to="/" className="underline">
                            share a survey link
                          </Link>
                          .
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalRows > 0 && (
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Page {page + 1} of {totalPages} &middot; {totalRows} total
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Previous page"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Next page"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
