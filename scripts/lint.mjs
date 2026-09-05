import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".sh", ".json", ".md", ".yml", ".yaml", ".txt", ".css", ".html"]);
const SKIP = new Set([".git", "node_modules", ".proofline"]);
const failures = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(absolute);
      continue;
    }
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
    const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
    const text = await readFile(absolute, "utf8");
    if (path.extname(entry.name) === ".json") {
      try {
        JSON.parse(text);
      } catch (error) {
        failures.push(`${relative}: invalid JSON (${error.message})`);
      }
    }
    if (text.includes("\r\n")) failures.push(`${relative}: uses CRLF line endings`);
    if (!text.endsWith("\n")) failures.push(`${relative}: missing final newline`);
    for (const [index, line] of text.split("\n").entries()) {
      if (/[ \t]+$/u.test(line)) failures.push(`${relative}:${index + 1}: trailing whitespace`);
    }
  }
}

await visit(ROOT);
const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
const pluginJson = JSON.parse(await readFile(path.join(ROOT, ".codex-plugin", "plugin.json"), "utf8"));
if (packageJson.version !== pluginJson.version) failures.push("package and plugin versions differ");
if (packageJson.name !== pluginJson.name) failures.push("package and plugin names differ");

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Lint checks passed.\n");
}
