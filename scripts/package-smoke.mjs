import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

if (!process.argv[2]) throw new Error("Usage: node scripts/package-smoke.mjs <installed-package-root>");
const packageRoot = path.resolve(process.argv[2]);
const bin = path.join(packageRoot, "bin", "proofline.js");
const scratch = await mkdtemp(path.join(os.tmpdir(), "proofline-package-smoke-"));
const clock = "2026-09-05T00:00:00.000Z";
function invoke(args, expected = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd: scratch, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, expected, result.stderr || result.error?.message);
  return result.stdout;
}

try {
  assert.match(invoke(["version"]), /0\.1\.0/u);
  const example = path.join(packageRoot, "examples", "release-readiness", "proofline.json");
  const status = JSON.parse(invoke(["status", "--json", "--manifest", example, "--at", clock]));
  assert.deepEqual(status.criteria.map((item) => item.status), ["verified", "verified", "stale", "declared-only", "failed", "missing"]);
  invoke(["check", "--manifest", example, "--at", clock], 1);
  await access(path.join(packageRoot, ".codex-plugin", "plugin.json"));
  await access(path.join(packageRoot, "skills", "proofline", "SKILL.md"));
  await access(path.join(packageRoot, "hooks", "hooks.json"));
  invoke(["init"]);
  const manifestPath = path.join(scratch, "proofline.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.criteria[1].proof[0] = { id: "artifact", kind: "file", label: "Synthetic artifact", path: "artifact.txt" };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(scratch, "artifact.txt"), "Synthetic package smoke artifact.\n");
  invoke(["run", "AC-01/tests", "--", process.execPath, "-e", "process.stdout.write('package smoke')"]);
  invoke(["capture", "AC-02/artifact"]);
  assert.equal(JSON.parse(invoke(["check", "--json"])).ready, true);
  for (const format of ["html", "markdown", "json"]) invoke(["report", "--format", format, "--output", `report.${format}`]);
  const expected = { "checkout-shockwave": 2, "incident-isolation": 1, "release-surface": 1 };
  for (const [scenario, newlyStale] of Object.entries(expected)) {
    const root = path.join(packageRoot, "examples", "goal-delta", scenario);
    const output = path.join(scratch, scenario);
    await mkdir(output);
    invoke(["goal-delta", "--manifest", path.join(root, "proofline.json"), "--from", path.join(root, "contracts", "before.json"), "--to", path.join(root, "contracts", "after.json"), "--dependencies", path.join(root, "dependencies.json"), "--output", path.join(output, "report.html"), "--profile-output", path.join(output, "profile.json"), "--at", "2026-08-30T08:00:00.000Z"]);
    const actual = await readFile(path.join(output, "profile.json"), "utf8");
    assert.equal(JSON.parse(actual).summary.counts.newlyStaleEvidence, newlyStale);
    assert.equal(actual, await readFile(path.join(root, "goal-delta.workprint.json"), "utf8"));
    const beforeQuery = await readdir(output);
    const query = JSON.parse(invoke(["goal-delta", "--manifest", path.join(root, "proofline.json"), "--from", path.join(root, "contracts", "before.json"),
      "--to", path.join(root, "contracts", "after.json"), "--dependencies", path.join(root, "dependencies.json"), "--json", "--gaps", "--at", "2026-08-30T08:00:00.000Z"]));
    assert.equal(query.summary.counts.newlyStaleEvidence, newlyStale);
    assert.ok(query.query.targetRevision);
    assert.deepEqual(await readdir(output), beforeQuery);
  }
  await writeFile(path.join(scratch, "requirements.json"), JSON.stringify({ schemaVersion: "intake-requirements/1", scope: "package", revision: 1, requirements: [
    { id: "package-R001", revision: 1, confirmation: "user-confirmed", supportDigest: "a".repeat(64), text: "Synthetic package acceptance.", pointer: { sourceId: "USER", locator: "manual" } }
  ] }));
  invoke(["import-intake", "--input", "requirements.json", "--output", "contract.json"]);
  await writeFile(path.join(scratch, "deps.json"), JSON.stringify({ schemaVersion: "proofline-goal-dependencies/1", evidence: [
    { id: "AC-01/tests", dependsOn: ["package-R001"] }, { id: "AC-02/artifact", dependsOn: ["package-R001"] }
  ] }));
  const unbound = JSON.parse(invoke(["query", "--contract", "contract.json", "--dependencies", "deps.json", "--gaps"]));
  assert.equal(unbound.evidence.length, 2);
  invoke(["doctor", "--contract", "contract.json", "--dependencies", "deps.json", "--json"], 1);
  invoke(["run", "AC-01/tests", "--contract", "contract.json", "--dependencies", "deps.json", "--", process.execPath, "-e", "process.exit(0)"]);
  invoke(["capture", "AC-02/artifact", "--contract", "contract.json", "--dependencies", "deps.json"]);
  assert.equal(JSON.parse(invoke(["query", "--contract", "contract.json", "--dependencies", "deps.json", "--gaps"])).evidence.length, 0);
  process.stdout.write("Installed package smoke passed: base CLI/five states/reports/plugin, exact Goal Delta projections and JSON, Intake import, configuration checks, bound run/capture and target query.\n");
} finally {
  assert.ok(scratch.startsWith(path.join(os.tmpdir(), "proofline-package-smoke-")));
  await rm(scratch, { recursive: true, force: true });
}
