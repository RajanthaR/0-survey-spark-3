export type BundleChunk = {
  fileName: string;
  name: string;
  facadeModuleId: string | null;
  isEntry: boolean;
  isDynamicEntry: boolean;
  imports: string[];
  dynamicImports: string[];
  modules: string[];
  rawBytes: number;
  gzipBytes: number;
};

export type BundleOutput = {
  dir: string;
  format: string | undefined;
  chunks: BundleChunk[];
};

export type BundleShape = {
  version: 1;
  generatedAt: string;
  outputs: BundleOutput[];
};

export type BundleTarget = {
  name: string;
  moduleIncludes: string[];
  limitBytes: number;
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function chunkMatches(chunk: BundleChunk, moduleIncludes: string[]): boolean {
  const facade = chunk.facadeModuleId ? normalizePath(chunk.facadeModuleId) : "";
  return moduleIncludes.some((needle) => {
    const normalizedNeedle = normalizePath(needle);
    return (
      facade.includes(normalizedNeedle) ||
      chunk.modules.some((moduleId) => normalizePath(moduleId).includes(normalizedNeedle))
    );
  });
}

function facadeMatches(chunk: BundleChunk, moduleIncludes: string[]): boolean {
  const facade = chunk.facadeModuleId ? normalizePath(chunk.facadeModuleId) : "";
  return moduleIncludes.some((needle) => facade.includes(normalizePath(needle)));
}

export function selectClientOutput(shape: BundleShape): BundleOutput {
  const client = shape.outputs.find((output) => normalizePath(output.dir).endsWith("/dist/client"));
  if (client) return client;

  const routeOutput = shape.outputs.find((output) =>
    output.chunks.some((chunk) => chunkMatches(chunk, ["src/routes/s.$slug.tsx"])),
  );
  if (routeOutput) return routeOutput;

  throw new Error("bundle-shape.json does not contain a client route output");
}

export function findTargetChunks(output: BundleOutput, target: BundleTarget): BundleChunk[] {
  const facadeChunks = output.chunks.filter((chunk) => facadeMatches(chunk, target.moduleIncludes));
  if (facadeChunks.length) return facadeChunks;
  return output.chunks.filter((chunk) => chunkMatches(chunk, target.moduleIncludes));
}

export function staticChunkClosure(output: BundleOutput, seeds: BundleChunk[]): BundleChunk[] {
  const byFile = new Map(output.chunks.map((chunk) => [chunk.fileName, chunk]));
  const seen = new Set<string>();
  const out: BundleChunk[] = [];
  const stack = [...seeds];

  while (stack.length) {
    const chunk = stack.pop()!;
    if (seen.has(chunk.fileName)) continue;
    seen.add(chunk.fileName);
    out.push(chunk);

    for (const imported of chunk.imports) {
      const next = byFile.get(imported);
      if (next) stack.push(next);
    }
  }

  return out.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function totalGzipBytes(chunks: BundleChunk[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export const BUNDLE_BUDGETS: BundleTarget[] = [
  {
    name: "respondent / route",
    moduleIncludes: ["src/routes/index.tsx"],
    limitBytes: 200 * 1024,
  },
  {
    name: "respondent /s/$slug",
    moduleIncludes: ["src/routes/s.$slug.tsx"],
    limitBytes: 260 * 1024,
  },
  {
    name: "admin route shell",
    moduleIncludes: ["src/routes/admin.tsx?tsr-split=component"],
    limitBytes: 180 * 1024,
  },
  {
    name: "admin charts chunk",
    moduleIncludes: [
      "src/components/admin/DashboardCharts.tsx",
      "src/components/admin/DropoffChart.tsx",
    ],
    limitBytes: 320 * 1024,
  },
];

export const RESPONDENT_TARGETS: BundleTarget[] = BUNDLE_BUDGETS.filter((target) =>
  target.name.startsWith("respondent"),
);

export const ADMIN_ONLY_PACKAGES = ["recharts", "xlsx", "jspdf", "fflate"] as const;
