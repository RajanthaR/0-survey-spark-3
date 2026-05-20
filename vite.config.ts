import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import type { OutputChunk } from "rollup";
import tsConfigPaths from "vite-tsconfig-paths";
import { devRouteRefreshPlugin } from "./src/lib/dev-route-refresh-plugin";

function bundleShapePlugin(): PluginOption {
  const outputs: Array<{
    dir: string;
    format: string | undefined;
    chunks: Array<{
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
    }>;
  }> = [];

  return {
    name: "survey-spark:bundle-shape",
    apply: "build",
    generateBundle(outputOptions, bundle) {
      const outputDir = resolve(
        outputOptions.dir ?? dirname(outputOptions.file ?? "dist/client/index.js"),
      );
      const chunks = Object.values(bundle)
        .filter((asset): asset is OutputChunk => asset.type === "chunk")
        .map((chunk) => ({
          fileName: chunk.fileName,
          name: chunk.name,
          facadeModuleId: chunk.facadeModuleId,
          isEntry: chunk.isEntry,
          isDynamicEntry: chunk.isDynamicEntry,
          imports: [...chunk.imports],
          dynamicImports: [...chunk.dynamicImports],
          modules: Object.keys(chunk.modules).sort(),
          rawBytes: new TextEncoder().encode(chunk.code).byteLength,
          gzipBytes: gzipSync(chunk.code).byteLength,
        }))
        .sort((a, b) => a.fileName.localeCompare(b.fileName));

      outputs.push({
        dir: outputDir,
        format: outputOptions.format,
        chunks,
      });
    },
    closeBundle() {
      if (!outputs.length) return;
      const outPath = resolve("dist/bundle-shape.json");
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(
        outPath,
        JSON.stringify(
          {
            version: 1,
            generatedAt: new Date().toISOString(),
            outputs,
          },
          null,
          2,
        ),
      );
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    react(),
    devRouteRefreshPlugin(),
    bundleShapePlugin(),
  ];

  if (command === "build") {
    plugins.push(cloudflare());
  }

  return {
    plugins,
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
    server: {
      host: "::",
      port: 5173,
      strictPort: false,
    },
  };
});
