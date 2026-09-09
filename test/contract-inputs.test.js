import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { importIntake } from "../src/intake-import.js";
import { createTestDirectory, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const BIN = fileURLToPath(new URL("../bin/proofline.js", import.meta.url));
function snapshot(revision = 1) {
  return { schemaVersion: "intake-requirements/1", scope: "review", revision, nextId: 3, nextSourceId: 1, sources: [], sourceHistory: [],
    requirements: [1, 2].map(id => ({ id: `review-R00${id}`, revision: id === 1 ? revision : 1, identityKey: String(id).repeat(64), supportDigest: "a".repeat(64),
      text: id === 1 ? `Acceptance at revision ${revision}.` : "Unchanged acceptance.", confirmation: "user-confirmed", authorship: "user-authored", pointer: { sourceId: "USER", locator: "manual" } })) };
}
function invoke(args, cwd) { return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" }); }

test("all contract entry points accept direct snapshots and reject malformed unconfirmed data before observation", async t => {
  const directory = await createTestDirectory("contract-inputs");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), { version: 1, project: "Direct inputs", criteria: [
    { id: "AC", statement: "Explicit checks.", proof: [
      { id: "run", kind: "command", label: "Node check", inputs: ["input.txt"] },
      { id: "file", kind: "file", label: "Selected artifact", path: "input.txt" }
    ] }
  ] });
  await writeFile(path.join(directory, "input.txt"), "selected artifact");
  await writeJson(path.join(directory, "before.json"), snapshot());
  await writeJson(path.join(directory, "after.json"), snapshot(2));
  await writeJson(path.join(directory, "dependencies.json"), { schemaVersion: "proofline-goal-dependencies/1", evidence: [
    { id: "AC/run", dependsOn: ["review-R001"] }, { id: "AC/file", dependsOn: ["review-R002"] }
  ] });
  const binding = ["--contract", "before.json", "--dependencies", "dependencies.json"];
  for (const args of [["doctor", ...binding, "--json"], ["run", "AC/run", ...binding, "--", process.execPath, "-e", "process.exit(0)"],
    ["capture", "AC/file", ...binding], ["query", ...binding]]) {
    const result = invoke(args, directory); assert.equal(result.status, 0, result.stderr);
  }
  const imported = invoke(["import-intake", "--input", "before.json"], directory);
  assert.equal(imported.status, 0, imported.stderr);
  assert.deepEqual(JSON.parse(imported.stdout), importIntake(snapshot()));
  await writeJson(path.join(directory, "normalized.json"), JSON.parse(imported.stdout));
  const fixedClock = new Date().toISOString();
  const direct = JSON.parse(invoke(["query", ...binding, "--at", fixedClock], directory).stdout);
  const normalized = JSON.parse(invoke(["query", "--contract", "normalized.json", "--dependencies", "dependencies.json", "--at", fixedClock], directory).stdout);
  assert.deepEqual(direct, normalized);
  const deltaArgs = ["goal-delta", "--from", "before.json", "--to", "after.json", "--dependencies", "dependencies.json", "--json"];
  const delta = JSON.parse(invoke(deltaArgs, directory).stdout);
  assert.deepEqual(delta.evidence.map(item => item.status), ["verified", "stale"]);
  const revoked = snapshot(); revoked.revision = 2; revoked.requirements[1].confirmation = "candidate";
  await writeJson(path.join(directory, "revoked.json"), revoked);
  const removal = JSON.parse(invoke(["goal-delta", "--from", "before.json", "--to", "revoked.json", "--dependencies", "dependencies.json", "--json"], directory).stdout);
  assert.equal(removal.evidence.find(item => item.id === "AC/file").status, "stale");
  assert.equal(removal.evidence.find(item => item.id === "AC/file").action.kind, "retire");
  assert.notEqual(invoke(["query", "--contract", "revoked.json", "--dependencies", "dependencies.json"], directory).status, 0);
  const ledgerBefore = await readFile(path.join(directory, ".proofline/evidence.jsonl"), "utf8");
  const malformed = snapshot();
  malformed.requirements[1].confirmation = "candidate";
  delete malformed.requirements[1].supportDigest;
  await writeJson(path.join(directory, "before.json"), malformed);
  for (const args of [["doctor", ...binding, "--json"], ["run", "AC/run", ...binding, "--", process.execPath, "-e", "process.exit(0)"],
    ["capture", "AC/file", ...binding], ["query", ...binding], deltaArgs, ["import-intake", "--input", "before.json", "--output", "rejected.json"]]) {
    const result = invoke(args, directory);
    assert.notEqual(result.status, 0);
    if (args[0] !== "doctor") assert.equal(result.stdout, "");
    assert.equal(await readFile(path.join(directory, ".proofline/evidence.jsonl"), "utf8"), ledgerBefore);
  }
  assert.ok(!(await readdir(directory)).includes("rejected.json"));
});

test("returned argv rechecks the target with a nondefault manifest and refuses later target drift", async t => {
  const directory = await createTestDirectory("recheck-context");
  t.after(() => removeTestDirectory(directory));
  const project = path.join(directory, "selected project");
  const elsewhere = path.join(directory, "caller elsewhere");
  await mkdir(project); await mkdir(elsewhere);
  const manifestPath = path.join(project, "acceptance manifest.json");
  await writeJson(manifestPath, { version: 1, project: "Chosen project", criteria: [{ id: "AC", statement: "Explicit verification.", proof: [
    { id: "run", kind: "command", label: "Literal argv check", inputs: ["probe.mjs"] }, { id: "file", kind: "file", label: "Artifact", path: "artifact.txt" }
  ] }] });
  await writeFile(path.join(project, "probe.mjs"), "import assert from 'node:assert/strict'; assert.equal(process.argv[2], 'literal & spaced argument');\n");
  await writeFile(path.join(project, "artifact.txt"), "unchanged bytes");
  const before = path.join(project, "prior requirements.json"), after = path.join(project, "target requirements.json"), deps = path.join(project, "explicit mapping.json");
  await writeJson(before, snapshot()); await writeJson(after, snapshot(2));
  await writeJson(deps, { schemaVersion: "proofline-goal-dependencies/1", evidence: ["AC/run", "AC/file"].map(id => ({ id, dependsOn: ["review-R001"] })) });
  const priorBinding = ["--manifest", manifestPath, "--contract", before, "--dependencies", deps];
  assert.equal(invoke(["run", "AC/run", ...priorBinding, "--", process.execPath, "probe.mjs", "literal & spaced argument"], elsewhere).status, 0);
  assert.equal(invoke(["capture", "AC/file", ...priorBinding], elsewhere).status, 0);
  const result = invoke(["goal-delta", "--manifest", manifestPath, "--from", before, "--to", after, "--dependencies", deps, "--json", "--gaps"], elsewhere);
  assert.equal(result.status, 0, result.stderr);
  const actions = JSON.parse(result.stdout).evidence.map(item => item.action);
  assert.equal(actions.length, 2);
  for (const action of actions) {
    assert.equal(action.contextComplete, true);
    assert.equal(action.cwd, project);
    assert.equal(action.argv[action.argv.indexOf("--manifest") + 1], manifestPath);
    assert.equal(action.argv[action.argv.indexOf("--contract") + 1], after);
    assert.equal(action.command, null);
    const executed = spawnSync(action.executable, action.argv, { cwd: action.cwd, encoding: "utf8", shell: false });
    assert.equal(executed.status, 0, executed.stderr);
  }
  const final = JSON.parse(invoke(["query", "--manifest", manifestPath, "--contract", after, "--dependencies", deps, "--gaps"], elsewhere).stdout);
  assert.equal(final.evidence.length, 0);
  assert.equal(final.summary.counts.verified, 2);
  assert.deepEqual(await readdir(elsewhere), []);
  const ledger = path.join(project, ".proofline/evidence.jsonl");
  const unchangedLedger = await readFile(ledger, "utf8");
  await writeJson(after, snapshot(3));
  const refused = spawnSync(actions[0].executable, actions[0].argv, { cwd: actions[0].cwd, encoding: "utf8", shell: false });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /Target contract changed/);
  assert.equal(await readFile(ledger, "utf8"), unchangedLedger);
});
