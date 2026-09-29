import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const output = await mkdtemp(resolve(tmpdir(), "rechtschreib-trainer-tests-"));
try {
  const entries = [
    resolve(root, "tests/engine.test.ts"),
    resolve(root, "tests/validation.test.ts"),
  ];
  await build({
    entryPoints: entries,
    outdir: output,
    bundle: true,
    format: "esm",
    platform: "node",
    target: ["node20"],
  });
  const result = spawnSync(process.execPath, ["--test", ...entries.map((entry) =>
    resolve(output, `${entry.split("/").at(-1).replace(/\.ts$/, ".js")}`),
  )], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}
