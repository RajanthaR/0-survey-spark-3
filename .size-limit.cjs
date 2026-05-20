const fs = require("node:fs");
const path = require("node:path");

const shapePath = path.join(__dirname, "dist", "bundle-shape.json");

const budgets = [
  {
    name: "respondent / route",
    moduleIncludes: ["src/routes/index.tsx"],
    limit: "200 KB",
  },
  {
    name: "respondent /s/$slug",
    moduleIncludes: ["src/routes/s.$slug.tsx"],
    limit: "260 KB",
  },
  {
    name: "admin route shell",
    moduleIncludes: ["src/routes/admin.tsx?tsr-split=component"],
    limit: "180 KB",
  },
  {
    name: "admin charts chunk",
    moduleIncludes: [
      "src/components/admin/DashboardCharts.tsx",
      "src/components/admin/DropoffChart.tsx",
    ],
    limit: "320 KB",
  },
];

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function chunkMatches(chunk, moduleIncludes) {
  const facade = chunk.facadeModuleId ? normalizePath(chunk.facadeModuleId) : "";
  return moduleIncludes.some((needle) => {
    const normalizedNeedle = normalizePath(needle);
    return (
      facade.includes(normalizedNeedle) ||
      chunk.modules.some((moduleId) => normalizePath(moduleId).includes(normalizedNeedle))
    );
  });
}

function facadeMatches(chunk, moduleIncludes) {
  const facade = chunk.facadeModuleId ? normalizePath(chunk.facadeModuleId) : "";
  return moduleIncludes.some((needle) => facade.includes(normalizePath(needle)));
}

function findTargetChunks(output, moduleIncludes) {
  const facadeChunks = output.chunks.filter((chunk) => facadeMatches(chunk, moduleIncludes));
  if (facadeChunks.length) return facadeChunks;
  return output.chunks.filter((chunk) => chunkMatches(chunk, moduleIncludes));
}

function selectClientOutput(shape) {
  return (
    shape.outputs.find((output) => normalizePath(output.dir).endsWith("/dist/client")) ??
    shape.outputs.find((output) =>
      output.chunks.some((chunk) => chunkMatches(chunk, ["src/routes/s.$slug.tsx"])),
    )
  );
}

function closure(output, seeds) {
  const byFile = new Map(output.chunks.map((chunk) => [chunk.fileName, chunk]));
  const seen = new Set();
  const out = [];
  const stack = [...seeds];
  while (stack.length) {
    const chunk = stack.pop();
    if (seen.has(chunk.fileName)) continue;
    seen.add(chunk.fileName);
    out.push(chunk);
    for (const imported of chunk.imports) {
      const next = byFile.get(imported);
      if (next) stack.push(next);
    }
  }
  return out;
}

function isSharedRuntimeChunk(fileName) {
  return /^assets\/(index-|proxy-|label-|types-|createLucideIcon-|loader-circle-|LanguageToggle-|resume-token-storage-)/.test(
    fileName,
  );
}

function budgetChunks(name, output, seeds) {
  if (name === "admin charts chunk") {
    return closure(output, seeds).filter(
      (chunk) =>
        seeds.some((seed) => seed.fileName === chunk.fileName) ||
        (!isSharedRuntimeChunk(chunk.fileName) && !chunk.fileName.startsWith("assets/admin-")),
    );
  }
  return seeds;
}

function fallbackConfig() {
  return budgets.map((budget) => ({
    name: budget.name,
    path: "dist/client/assets/*.js",
    limit: budget.limit,
    gzip: true,
    webpack: false,
    running: false,
  }));
}

if (!fs.existsSync(shapePath)) {
  module.exports = fallbackConfig();
} else {
  const shape = JSON.parse(fs.readFileSync(shapePath, "utf8"));
  const output = selectClientOutput(shape);
  if (!output) {
    module.exports = fallbackConfig();
  } else {
    module.exports = budgets.map((budget) => {
      const seeds = findTargetChunks(output, budget.moduleIncludes);
      const files = budgetChunks(budget.name, output, seeds).map((chunk) =>
        path.relative(__dirname, path.join(output.dir, chunk.fileName)),
      );
      return {
        name: budget.name,
        path: files.length ? files : "dist/client/assets/*.js",
        limit: budget.limit,
        gzip: true,
        webpack: false,
        running: false,
      };
    });
  }
}
