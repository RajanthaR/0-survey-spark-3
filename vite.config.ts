import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
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

// @tanstack/start-storage-context does `new AsyncLocalStorage()` at module
// scope. The dev server doesn't tree-shake it out of the client graph (the
// production client bundle does), so the browser hits Vite's external stub
// and the client entry crashes before hydration. Resolve `node:async_hooks`
// to a small browser shim for non-SSR resolution only.
function clientAsyncHooksShimPlugin(): PluginOption {
  const shimPath = resolve(import.meta.dirname, "src/lib/node-async-hooks.browser.ts");
  return {
    name: "survey-spark:client-async-hooks-shim",
    enforce: "pre",
    resolveId(source, _importer, options) {
      if (source !== "node:async_hooks" && source !== "async_hooks") return null;
      if (options?.ssr) return null;
      return shimPath;
    },
  };
}

// TanStack Start emits dist/server/server.js (Web-Fetch handler) and dist/client/* assets.
// The Node runtime entry at server-node.mjs imports the server bundle and serves both via srvx.
export default defineConfig(() => {
  const commitSha = process.env.GITHUB_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? "main";
  const plugins: PluginOption[] = [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    react(),
    devRouteRefreshPlugin(),
    bundleShapePlugin(),
    clientAsyncHooksShimPlugin(),
  ];

  return {
    plugins,
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
    },
    optimizeDeps: {
      // Keep these out of the esbuild prebundle so the async_hooks shim
      // plugin can intercept their `node:async_hooks` import in dev.
      exclude: ["@tanstack/start-client-core", "@tanstack/start-storage-context"],
    },
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
