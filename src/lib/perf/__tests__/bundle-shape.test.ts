import { describe, expect, it } from "vitest";

import {
  findTargetChunks,
  selectClientOutput,
  staticChunkClosure,
  totalGzipBytes,
  type BundleShape,
} from "@/lib/perf/bundle-shape";

const shape = {
  version: 1,
  generatedAt: "2026-05-20T00:00:00.000Z",
  outputs: [
    {
      dir: "/repo/dist/server",
      format: "es",
      chunks: [],
    },
    {
      dir: "/repo/dist/client",
      format: "es",
      chunks: [
        {
          fileName: "assets/root.js",
          name: "root",
          facadeModuleId: "/repo/src/routes/__root.tsx",
          isEntry: false,
          isDynamicEntry: true,
          imports: [],
          dynamicImports: ["assets/s._slug.js"],
          modules: ["/repo/src/routes/__root.tsx"],
          rawBytes: 100,
          gzipBytes: 40,
        },
        {
          fileName: "assets/s._slug.js",
          name: "s._slug",
          facadeModuleId: "/repo/src/routes/s.$slug.tsx",
          isEntry: false,
          isDynamicEntry: true,
          imports: ["assets/shared.js"],
          dynamicImports: [],
          modules: ["/repo/src/routes/s.$slug.tsx"],
          rawBytes: 120,
          gzipBytes: 50,
        },
        {
          fileName: "assets/shared.js",
          name: "shared",
          facadeModuleId: null,
          isEntry: false,
          isDynamicEntry: false,
          imports: [],
          dynamicImports: [],
          modules: ["/repo/src/components/SurveyRunner.tsx"],
          rawBytes: 60,
          gzipBytes: 25,
        },
      ],
    },
  ],
} satisfies BundleShape;

describe("bundle-shape helpers", () => {
  it("selects the client output and finds route chunks by facade module", () => {
    const output = selectClientOutput(shape);
    const chunks = findTargetChunks(output, {
      name: "respondent",
      moduleIncludes: ["src/routes/s.$slug.tsx"],
      limitBytes: 1,
    });

    expect(chunks.map((chunk) => chunk.fileName)).toEqual(["assets/s._slug.js"]);
  });

  it("walks static imports without pulling dynamic imports into the closure", () => {
    const output = selectClientOutput(shape);
    const seeds = findTargetChunks(output, {
      name: "respondent",
      moduleIncludes: ["src/routes/__root.tsx"],
      limitBytes: 1,
    });
    const closure = staticChunkClosure(output, seeds);

    expect(closure.map((chunk) => chunk.fileName)).toEqual(["assets/root.js"]);
  });

  it("sums gzip bytes for a static route closure", () => {
    const output = selectClientOutput(shape);
    const seeds = findTargetChunks(output, {
      name: "respondent",
      moduleIncludes: ["src/routes/s.$slug.tsx"],
      limitBytes: 1,
    });

    expect(totalGzipBytes(staticChunkClosure(output, seeds))).toBe(75);
  });
});
