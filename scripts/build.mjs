import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [template, styles] = await Promise.all([
  readFile(resolve(root, "src/index.html"), "utf8"),
  readFile(resolve(root, "src/styles.css"), "utf8"),
]);
const result = await build({
  entryPoints: [resolve(root, "src/main.ts")],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: ["es2022"],
  legalComments: "none",
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = template
  .replace("<!-- STYLES -->", `<style>${styles}</style>`)
  .replace("<!-- SCRIPT -->", `<script>${script}</script>`);
const output = resolve(root, "dist/index.html");
await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(output, html);
console.log(`Built ${output}`);
