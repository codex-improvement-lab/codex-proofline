// Explicitly install a small optional sidecar into the caller-selected checkout.
import { access, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

if (process.argv.length !== 3) throw new Error("Usage: node prepare.mjs <driftproof-checkout>");
const root = path.resolve(process.argv[2]);
await access(path.join(root, "lib", "importers.js"));
const manifestPath = path.join(root, "proofline-import-trial.json");
try {
  await lstat(manifestPath);
  throw new Error("Refusing to overwrite an existing proofline-import-trial.json.");
} catch (error) { if (error.code !== "ENOENT") throw error; }
const evidenceRoot = path.join(root, ".proofline");
await mkdir(evidenceRoot, { recursive: true });
if ((await lstat(evidenceRoot)).isSymbolicLink()) throw new Error("Refusing a linked .proofline directory.");
const sidecar = path.join(evidenceRoot, "lab-import-trial");
await mkdir(sidecar); // Existing owned or user content is never replaced.
await writeFile(path.join(sidecar, "probe.mjs"), await readFile(new URL("probe.mjs", import.meta.url)), { flag: "wx" });
const inputs = ["lib", "config", "config.js", "package.json", ".proofline/lab-import-trial/probe.mjs"];
const manifest = {
  version: 1, project: "Driftproof importer count review", completionPolicy: "warn",
  ledger: ".proofline/lab-import-trial/evidence.jsonl",
  criteria: [
    { id: "DECLARED", statement: "Imported results remain declarations from an external harness.",
      proof: [{ id: "imports", kind: "command", label: "Imported evidence level", inputs, expect: { exitCode: 0 } }] },
    { id: "COUNTS", statement: "Absent judge-sample counts remain unknown; observed trial rewards are preserved separately.",
      proof: [{ id: "imports", kind: "command", label: "Missing count and trial-count semantics", inputs, expect: { exitCode: 0 } }] }
  ]
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
process.stdout.write("Prepared proofline-import-trial.json and .proofline/lab-import-trial/probe.mjs. Review the declared criteria and input scopes before recording checks.\n");
