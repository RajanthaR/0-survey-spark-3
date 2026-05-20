import { readFileSync } from "node:fs";

import {
  BUNDLE_BUDGETS,
  findTargetChunks,
  formatBytes,
  selectClientOutput,
  staticChunkClosure,
  totalGzipBytes,
  type BundleShape,
} from "../src/lib/perf/bundle-shape";

const shape = JSON.parse(readFileSync("dist/bundle-shape.json", "utf8")) as BundleShape;
const output = selectClientOutput(shape);

function isSharedRuntimeChunk(fileName: string): boolean {
  return /^assets\/(index-|proxy-|label-|types-|createLucideIcon-|loader-circle-|LanguageToggle-|resume-token-storage-)/.test(
    fileName,
  );
}

function budgetChunksForTarget(
  target: (typeof BUNDLE_BUDGETS)[number],
  seeds: ReturnType<typeof findTargetChunks>,
) {
  if (target.name === "admin charts chunk") {
    return staticChunkClosure(output, seeds).filter(
      (chunk) =>
        seeds.some((seed) => seed.fileName === chunk.fileName) ||
        (!isSharedRuntimeChunk(chunk.fileName) && !chunk.fileName.startsWith("assets/admin-")),
    );
  }

  return seeds;
}

const rows = BUNDLE_BUDGETS.map((target) => {
  const seeds = findTargetChunks(output, target);
  if (!seeds.length) {
    throw new Error(`No chunks matched budget target "${target.name}"`);
  }
  const closure = budgetChunksForTarget(target, seeds);
  const gzipBytes = totalGzipBytes(closure);
  return {
    target,
    chunks: closure,
    gzipBytes,
    passed: gzipBytes <= target.limitBytes,
  };
});

const labelWidth = Math.max(...rows.map((row) => row.target.name.length));
console.log("Bundle budgets (static import closure, gzip)");
for (const row of rows) {
  const status = row.passed ? "OK" : "FAIL";
  const chunkList = row.chunks.map((chunk) => chunk.fileName).join(", ");
  console.log(
    `${status.padEnd(4)} ${row.target.name.padEnd(labelWidth)} ${formatBytes(row.gzipBytes).padStart(10)} / ${formatBytes(row.target.limitBytes).padStart(8)}  ${chunkList}`,
  );
}

const failed = rows.filter((row) => !row.passed);
if (failed.length) {
  console.error(
    `\n${failed.length} bundle budget${failed.length === 1 ? "" : "s"} exceeded. Run bun run build before rechecking.`,
  );
  process.exit(1);
}
