import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { importIntake } from "../src/intake-import.js";
import { compareGoalContracts, createWorkprintProfile, createGoalDelta, loadGoalContract, normalizeGoalContract, validateGoalContract } from "../src/goal-delta.js";
import { createTestDirectory, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const BIN = fileURLToPath(new URL("../bin/proofline.js", import.meta.url));
function snapshot() {
  return { schemaVersion: "intake-requirements/1", scope: "maintenance", revision: 2, nextId: 3, nextSourceId: 2,
    sources: [{ id: "S01", revision: 1, name: "request.txt", kind: "text", lineCount: 3, digest: "a".repeat(64), digestAlgorithm: "sha256" }], sourceHistory: [], requirements: [
    { id: "maintenance-R001", revision: 1, confirmation: "user-confirmed", supportDigest: "a".repeat(64), identityKey: "b".repeat(64), authorship: "rule-derived",
      text: "Private acceptance wording stays in the local contract.", pointer: { sourceId: "S01", sourceRevision: 1, locator: "L2", excerpt: "private source excerpt" } },
    { id: "maintenance-R002", revision: 1, confirmation: "candidate", text: "Another requirement.", supportDigest: "c".repeat(64), identityKey: "d".repeat(64), authorship: "rule-derived",
      pointer: { sourceId: "S01", sourceRevision: 1, locator: "L3" } }
  ] };
}
test("imports only confirmed scoped requirements and preserves explicit source dispositions", async (t) => {
  const directory = await createTestDirectory("intake-import");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "requirements.json"), snapshot());
  const result = spawnSync(process.execPath, [BIN, "import-intake", "--input", "requirements.json"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const contract = validateGoalContract(JSON.parse(result.stdout));
  assert.equal(contract.items.length, 1);
  assert.equal(contract.items[0].id, "maintenance-R001");
  assert.equal(contract.intake.requirements[1].confirmation, "candidate");
  assert.equal(contract.intake.requirements[0].pointer.sourceRevision, 1);
  assert.doesNotMatch(result.stdout, /private source excerpt|must not propagate|private command/);
  assert.deepEqual(await readdir(directory), ["requirements.json"]);
  const saved = spawnSync(process.execPath, [BIN, "import-intake", "--input", "requirements.json", "--output", "contract.json"], { cwd: directory, encoding: "utf8" });
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(saved.stdout, "");
  assert.equal(await readFile(path.join(directory, "contract.json"), "utf8"), result.stdout);
});
test("rejects foreign scope, duplicate or fabricated confirmed item associations", () => {
  const foreign = snapshot(); foreign.requirements[0].id = "other-R001";
  assert.throws(() => importIntake(foreign), /identity/);
  const duplicate = snapshot(); duplicate.requirements.push(duplicate.requirements[0]);
  assert.throws(() => importIntake(duplicate), /identity/);
  const contract = importIntake(snapshot());
  contract.intake.requirements[0].confirmation = "candidate";
  assert.throws(() => validateGoalContract(contract), /exactly/);
});
test("source-only revisions leave unchanged acceptance stable and public projections omit private requirement text", () => {
  const before = importIntake(snapshot());
  const sourceChanged = snapshot(); sourceChanged.revision = 3;
  sourceChanged.sourceHistory = structuredClone(sourceChanged.sources);
  sourceChanged.sources[0].revision = 2;
  sourceChanged.requirements[0].pointer.sourceRevision = 2;
  const after = importIntake(sourceChanged);
  assert.equal(compareGoalContracts(before, after)[0].verdict, "unchanged");
  sourceChanged.requirements[0].text = "Revised private acceptance.";
  sourceChanged.requirements[0].revision = 2;
  const revised = importIntake(sourceChanged);
  assert.equal(compareGoalContracts(before, revised)[0].verdict, "changed");
  const delta = createGoalDelta({ evaluation: { project: "Local task", generatedAt: "2026-09-08T00:00:00Z", criteria: [], summary: { verifiedProofs: 0 } },
    before, after: revised, dependencies: { evidence: [] } });
  const profile = JSON.stringify(createWorkprintProfile(delta));
  assert.doesNotMatch(profile, /private acceptance|Private acceptance|supportDigest|sourceRevision":2|source excerpt/);
  assert.match(profile, /maintenance-R001/);
});

test("direct snapshots and optional imports share strict complete-input normalization", async (t) => {
  const directory = await createTestDirectory("intake-normalize");
  t.after(() => removeTestDirectory(directory));
  const input = snapshot();
  await writeJson(path.join(directory, "snapshot.json"), input);
  assert.deepEqual(await loadGoalContract(path.join(directory, "snapshot.json")), normalizeGoalContract(importIntake(input)));
  const badInputs = [];
  const extra = snapshot(); extra.rawContent = "PRIVATE-EXTENSION"; badInputs.push(extra);
  const malformedCandidate = snapshot(); delete malformedCandidate.requirements[1].identityKey; badInputs.push(malformedCandidate);
  const wrongPointer = snapshot(); wrongPointer.requirements[0].pointer.sourceRevision = 9; badInputs.push(wrongPointer);
  const staleConfirmed = snapshot(); staleConfirmed.sourceHistory = structuredClone(staleConfirmed.sources); staleConfirmed.sources[0].revision = 2; badInputs.push(staleConfirmed);
  const duplicateSource = snapshot(); duplicateSource.sources.push(duplicateSource.sources[0]); badInputs.push(duplicateSource);
  for (const value of badInputs) {
    assert.throws(() => importIntake(value));
    assert.throws(() => normalizeGoalContract(value));
  }
});
