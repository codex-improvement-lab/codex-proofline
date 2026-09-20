import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createTestDirectory, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const example = path.join(root, "examples", "external", "driftproof-import-counts");
const probe = path.join(example, "probe.mjs");
const prepare = path.join(example, "prepare.mjs");
const bin = path.join(root, "bin", "proofline.js");
function invoke(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", timeout: 30000 });
  assert.ifError(result.error);
  return result;
}
async function fixture(directory, { counts = [1, 2], rewards = [1, 0] } = {}) {
  await mkdir(path.join(directory, "lib"), { recursive: true });
  await mkdir(path.join(directory, "config"), { recursive: true });
  await writeJson(path.join(directory, "package.json"), { name: "synthetic-importer-control", version: "0.0.0" });
  await writeFile(path.join(directory, "config.js"), "module.exports = {};\n");
  await writeFile(path.join(directory, "lib", "importers.js"), `
const receipt = samples => ({ verification_level: 'DECLARED', run: { surface: 'external', judge: { samples } }, results: { cases: [{ samples: ${JSON.stringify(rewards)} }] } });
module.exports = { importAgentSkillsEval: () => receipt(${JSON.stringify(counts[0])}), importSkillgrade: () => receipt(${JSON.stringify(counts[1])}) };
`);
}

test("external probe distinguishes missing counts, declaration controls and preserved rewards", async (t) => {
  const directory = await createTestDirectory("external-probe");
  t.after(() => removeTestDirectory(directory));
  await fixture(directory);
  let result = invoke(probe, [directory], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).assertions.filter(row => !row.passed).map(row => row.id),
    ["absent-agent-skills-judge-count-stays-unknown", "trial-count-is-not-judge-samples"]);
  assert.equal(invoke(probe, [directory, "--check", "declared"], directory).status, 0);
  await fixture(directory, { counts: [null, null] });
  assert.equal(invoke(probe, [directory], directory).status, 0);
  await fixture(directory, { counts: [null, null], rewards: [1] });
  result = invoke(probe, [directory], directory);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).assertions.filter(row => !row.passed).map(row => row.id),
    ["observed-trial-rewards-are-preserved"]);
  assert.equal(invoke(probe, [directory, "--check", "unknown"], directory).status, 2);
});

test("optional external sidecar preserves existing files and tracks actual source changes", async (t) => {
  const directory = await createTestDirectory("external-sidecar with spaces");
  t.after(() => removeTestDirectory(directory));
  await fixture(directory);
  await writeFile(path.join(directory, "proofline.json"), "existing user content\n");
  const prepared = invoke(prepare, [directory], directory);
  assert.equal(prepared.status, 0, prepared.stderr);
  const selected = path.join(directory, "proofline-import-trial.json");
  const before = await readFile(selected);
  assert.notEqual(invoke(prepare, [directory], directory).status, 0);
  assert.deepEqual(await readFile(selected), before);
  assert.equal(await readFile(path.join(directory, "proofline.json"), "utf8"), "existing user content\n");
  const observe = check => invoke(bin, ["run", `${check === "declared" ? "DECLARED" : "COUNTS"}/imports`,
    "--manifest", selected, "--", process.execPath, ".proofline/lab-import-trial/probe.mjs", ".", "--check", check], directory);
  const query = () => {
    const result = invoke(bin, ["query", "--manifest", selected], directory);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.equal(observe("declared").status, 0);
  assert.equal(observe("counts").status, 1);
  assert.deepEqual(query().evidence.map(row => row.status), ["verified", "failed"]);
  await fixture(directory, { counts: [null, null] });
  assert.deepEqual(query().evidence.map(row => row.status), ["stale", "failed"]);
  assert.equal(observe("declared").status, 0);
  assert.equal(observe("counts").status, 0);
  assert.equal(query().summary.counts.verified, 2);
});
