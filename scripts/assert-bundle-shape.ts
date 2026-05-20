import { readFileSync } from "node:fs";

import {
  ADMIN_ONLY_PACKAGES,
  RESPONDENT_TARGETS,
  findTargetChunks,
  selectClientOutput,
  staticChunkClosure,
  type BundleShape,
} from "../src/lib/perf/bundle-shape";

const shape = JSON.parse(readFileSync("dist/bundle-shape.json", "utf8")) as BundleShape;
const output = selectClientOutput(shape);

function moduleUsesPackage(moduleId: string, packageName: string): boolean {
  const normalized = moduleId.replace(/\\/g, "/");
  return (
    normalized.includes(`/node_modules/${packageName}/`) ||
    normalized.includes(`/node_modules/.bun/${packageName}@`)
  );
}

const violations: string[] = [];

for (const target of RESPONDENT_TARGETS) {
  const seeds = findTargetChunks(output, target);
  if (!seeds.length) {
    violations.push(`${target.name}: no matching route chunk found`);
    continue;
  }

  const closure = staticChunkClosure(output, seeds);
  for (const chunk of closure) {
    for (const moduleId of chunk.modules) {
      for (const packageName of ADMIN_ONLY_PACKAGES) {
        if (moduleUsesPackage(moduleId, packageName)) {
          violations.push(`${target.name}: ${packageName} reached via ${chunk.fileName}`);
        }
      }
    }
  }
}

if (violations.length) {
  console.error("Respondent bundle-shape regression:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Respondent bundle-shape OK: ${ADMIN_ONLY_PACKAGES.join(", ")} are absent from respondent route closures.`,
);
