#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const checkMode = process.argv.includes("--check");
const outDir = "test-results/db-diff";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(outDir, `supabase-db-diff-${stamp}.txt`);

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

await mkdir(dirname(reportPath), { recursive: true });

const args = ["db", "diff", "--schema", "public"];
if (process.env.SUPABASE_DB_URL) {
  args.push("--db-url", process.env.SUPABASE_DB_URL);
} else if (process.env.SUPABASE_ACCESS_TOKEN) {
  args.push("--linked");
}

const result = await run("supabase", args);
const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
await writeFile(
  reportPath,
  [
    `generated_at=${new Date().toISOString()}`,
    `command=supabase ${args.join(" ")}`,
    `exit_code=${result.code}`,
    "",
    output || "(no output)",
    "",
  ].join("\n"),
);

if (result.code !== 0) {
  console.error(`Supabase db diff command failed. Report: ${reportPath}`);
  if (output) console.error(output);
  process.exit(result.code ?? 1);
}

const normalized = output.trim();
console.log(`Supabase db diff report written to ${reportPath}`);
if (!normalized || /no (schema )?changes (found|detected)|schema is up to date/i.test(normalized)) {
  console.log("No schema drift reported.");
  process.exit(0);
}

console.log(normalized);
if (checkMode) {
  console.error("Schema drift detected.");
  process.exit(1);
}
