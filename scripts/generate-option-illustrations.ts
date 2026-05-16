#!/usr/bin/env bun
/**
 * Generates the per-option illustration assets declared in
 * `src/surveys/visuals/illustrations.manifest.ts`.
 *
 * This is a **dev-time** script — never invoked at runtime, never bundled.
 * Run it from the sandbox:
 *
 *     bun scripts/generate-option-illustrations.ts            # only missing
 *     bun scripts/generate-option-illustrations.ts --force    # regenerate all
 *     bun scripts/generate-option-illustrations.ts sector-*   # filter by glob
 *
 * Required env:
 *   IMAGE_GENERATION_ENDPOINT  OpenAI-compatible image generation endpoint.
 *   IMAGE_GENERATION_API_KEY   API key for the endpoint.
 *   IMAGE_GENERATION_MODEL     Model name accepted by the endpoint.
 *
 * Pipeline per spec:
 *   1. POST the prompt + `STYLE_PROMPT` to the configured endpoint.
 *   2. Decode the returned image data into a PNG buffer.
 *   3. Convert PNG → WebP via `cwebp` (provided through nix when missing).
 *   4. Write `src/assets/options/<slug>.webp`.
 *   5. Skip slugs whose webp already exists unless `--force`.
 *
 * Idempotent. Safe to re-run. Per-spec failures are reported but don't
 * stop the rest of the batch.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

import {
  ALL_ILLUSTRATIONS,
  STYLE_PROMPT,
  type IllustrationSpec,
} from "../src/surveys/visuals/illustrations.manifest";

const OUT_DIR = resolve(import.meta.dir, "../src/assets/options");

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const force = args.includes("--force");
  const filters = args.filter((a) => !a.startsWith("--"));
  return { force, filters };
}

function matchesFilter(slug: string, filters: string[]): boolean {
  if (filters.length === 0) return true;
  return filters.some((f) => {
    const rx = new RegExp("^" + f.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return rx.test(slug);
  });
}

function extractImage(json: unknown): string | undefined {
  const value = json as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const chatImage = value.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (chatImage) return chatImage;
  const image = value.data?.[0];
  if (image?.url) return image.url;
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  return undefined;
}

async function generatePng(
  spec: IllustrationSpec,
  endpoint: string,
  apiKey: string,
  model: string,
): Promise<Buffer> {
  const prompt = `${spec.prompt}. ${STYLE_PROMPT}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      prompt,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gateway ${res.status}: ${body.slice(0, 300)}`);
  }
  const dataUrl = extractImage(await res.json());
  if (!dataUrl) {
    throw new Error("no image data in generation response");
  }
  if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
    const imageRes = await fetch(dataUrl);
    if (!imageRes.ok) {
      throw new Error(`image download ${imageRes.status}`);
    }
    return Buffer.from(await imageRes.arrayBuffer());
  }
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("unsupported image response format");
  }
  const base64 = dataUrl.split(",")[1] ?? "";
  return Buffer.from(base64, "base64");
}

function pngToWebp(png: Buffer, dest: string): void {
  const tmp = resolve(tmpdir(), `option-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  writeFileSync(tmp, png);
  // -q 80 keeps assets under 25 KB at 512px for the flat 2-tone style.
  // -resize 512 0 normalises any over-sized model output.
  try {
    execFileSync("cwebp", ["-q", "80", "-resize", "512", "0", tmp, "-o", dest], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    // Fall back to nix if cwebp isn't on PATH in the sandbox.
    execFileSync(
      "nix",
      ["run", "nixpkgs#libwebp", "--", "cwebp", "-q", "80", "-resize", "512", "0", tmp, "-o", dest],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  }
}

async function main() {
  const endpoint = process.env.IMAGE_GENERATION_ENDPOINT;
  const apiKey = process.env.IMAGE_GENERATION_API_KEY;
  const model = process.env.IMAGE_GENERATION_MODEL;
  const missing = [
    ...(!endpoint ? ["IMAGE_GENERATION_ENDPOINT"] : []),
    ...(!apiKey ? ["IMAGE_GENERATION_API_KEY"] : []),
    ...(!model ? ["IMAGE_GENERATION_MODEL"] : []),
  ];
  if (missing.length > 0) {
    console.error(`${missing.join(", ")} not set. Aborting.`);
    process.exit(1);
  }
  const { force, filters } = parseArgs(process.argv);
  mkdirSync(OUT_DIR, { recursive: true });

  const targets = ALL_ILLUSTRATIONS.filter((s) => matchesFilter(s.slug, filters));
  if (targets.length === 0) {
    console.log("No matching specs.");
    return;
  }

  let made = 0;
  let skipped = 0;
  let failed = 0;
  for (const spec of targets) {
    const dest = resolve(OUT_DIR, `${spec.slug}.webp`);
    if (!force && existsSync(dest)) {
      skipped++;
      console.log(`skip   ${spec.slug} (exists)`);
      continue;
    }
    try {
      console.log(`gen    ${spec.slug} …`);
      const png = await generatePng(spec, endpoint!, apiKey!, model!);
      mkdirSync(dirname(dest), { recursive: true });
      pngToWebp(png, dest);
      made++;
      console.log(`ok     ${spec.slug}`);
    } catch (err) {
      failed++;
      console.error(`fail   ${spec.slug}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. ${made} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
