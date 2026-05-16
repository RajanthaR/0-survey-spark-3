import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { devRouteRefreshPlugin } from "./src/lib/dev-route-refresh-plugin";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    react(),
    devRouteRefreshPlugin(),
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
