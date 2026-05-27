import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type Threshold = {
  auditId: string;
  label: string;
  max: number;
  unit: string;
};

const BASE_URL = (process.env.BASE_URL ?? process.argv[2] ?? "").replace(/\/+$/, "");
const DEFAULT_PATHS = ["/", "/s/phase-1", "/admin", "/about", "/about/study"];

const PATHS = process.env.LIGHTHOUSE_PATHS
  ? process.env.LIGHTHOUSE_PATHS.split(",")
      .map((path) => path.trim())
      .filter(Boolean)
  : DEFAULT_PATHS;

const THRESHOLDS: Threshold[] = [
  { auditId: "largest-contentful-paint", label: "LCP", max: 2500, unit: "ms" },
  { auditId: "interactive", label: "TTI", max: 3500, unit: "ms" },
  { auditId: "cumulative-layout-shift", label: "CLS", max: 0.1, unit: "" },
];

if (!BASE_URL) {
  console.error("BASE_URL is required for Lighthouse CI checks.");
  process.exit(1);
}

const outDir = "test-results/lighthouse";
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function urlForPath(path: string): string {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function slugForPath(path: string): string {
  return path.replace(/^\//, "").replace(/[^a-z0-9-]+/gi, "-") || "home";
}

const failures: string[] = [];

for (const path of PATHS) {
  const url = urlForPath(path);
  const outputPath = join(outDir, `${slugForPath(path)}.json`);
  console.log(`Running Lighthouse: ${url}`);
  const result = spawnSync(
    "lighthouse",
    [
      url,
      "--quiet",
      "--only-categories=performance",
      "--output=json",
      `--output-path=${outputPath}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
    ],
    { encoding: "utf8", stdio: "inherit" },
  );

  if (result.status !== 0) {
    failures.push(`${path}: Lighthouse exited with ${result.status ?? "unknown status"}`);
    continue;
  }

  const lhr = JSON.parse(readFileSync(outputPath, "utf8")) as {
    audits: Record<string, { numericValue?: number }>;
  };
  for (const threshold of THRESHOLDS) {
    const value = lhr.audits[threshold.auditId]?.numericValue;
    if (typeof value !== "number") {
      failures.push(`${path}: ${threshold.label} was missing from Lighthouse output`);
      continue;
    }
    const rounded = threshold.unit === "ms" ? Math.round(value) : Number(value.toFixed(3));
    console.log(
      `${path} ${threshold.label}: ${rounded}${threshold.unit} <= ${threshold.max}${threshold.unit}`,
    );
    if (value > threshold.max) {
      failures.push(
        `${path}: ${threshold.label} ${rounded}${threshold.unit} exceeds ${threshold.max}${threshold.unit}`,
      );
    }
  }
}

if (failures.length) {
  console.error("\nLighthouse budget failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
