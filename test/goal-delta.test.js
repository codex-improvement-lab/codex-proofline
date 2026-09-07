import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareGoalContracts,
  createGoalDelta,
  createWorkprintProfile,
  validateGoalContract,
  validateGoalDependencies
} from "../src/goal-delta.js";
import { renderGoalDeltaHtml } from "../src/goal-delta-report.js";
import { appendRecord } from "../src/ledger.js";
import { sha256File } from "../src/util.js";
import {
  createTestDirectory,
  removeTestDirectory,
  writeJson
} from "../test-support/helpers.js";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/proofline.js");
const CLOCK = "2026-08-30T08:00:00.000Z";

function contract(revision, items, title = "Checkout acceptance contract") {
  return validateGoalContract({
    schemaVersion: "proofline-goal-contract/1",
    title,
    revision,
    items
  });
}

const BEFORE = contract("checkout-v1", [
  { id: "G-01", goal: "Keep retry safety.", acceptance: "No duplicate charge under retries." },
  { id: "G-02", goal: "Hold the latency envelope.", acceptance: "p95 remains below 1800 ms." },
  { id: "G-03", goal: "Ship the legacy export.", acceptance: "CSV v1 remains downloadable." }
]);

const AFTER = contract("checkout-v2", [
  { id: "G-01", goal: "Keep retry safety.", acceptance: "No duplicate charge under retries." },
  { id: "G-02", goal: "Hold the latency envelope.", acceptance: "p95 remains below 950 ms." },
  { id: "G-04", goal: "Add keyboard completion.", acceptance: "Checkout completes without pointer input." }
]);

function proof(id, status, record = null) {
  return {
    id: id.split("/")[1],
    ref: id,
    kind: id.endsWith("/artifact") ? "file" : "command",
    label: `${id} evidence`,
    status,
    reason: status === "verified" ? "Observed evidence is present, current, and passing." : `Base ${status}.`,
    record,
    environment: "Windows / automated"
  };
}

function evaluation() {
  const observed = {
    kind: "command",
    observed: true,
    command: ["node", "--test"],
    result: { exitCode: 0 }
  };
  const proofs = [
    proof("AC-01/latency", "verified", observed),
    proof("AC-02/retry", "verified", observed),
    proof("AC-03/legacy", "verified", observed),
    proof("AC-04/failed", "failed", observed),
    proof("AC-05/new", "missing"),
    proof("AC-06/declaration", "declared-only"),
    proof("AC-07/old-stale", "stale", observed)
  ];
  return {
    project: "Checkout",
    generatedAt: CLOCK,
    summary: { verifiedProofs: 3 },
    criteria: proofs.map((item, index) => ({
      id: `AC-${String(index + 1).padStart(2, "0")}`,
      statement: `Criterion ${index + 1}`,
      proofs: [item]
    }))
  };
}

function dependencies() {
  return validateGoalDependencies({
    schemaVersion: "proofline-goal-dependencies/1",
    evidence: [
      { id: "AC-01/latency", dependsOn: ["G-02"] },
      { id: "AC-02/retry", dependsOn: ["G-01"] },
      { id: "AC-03/legacy", dependsOn: ["G-03"] },
      { id: "AC-04/failed", dependsOn: ["G-02"] },
      { id: "AC-05/new", dependsOn: ["G-04"] },
      { id: "AC-06/declaration", dependsOn: ["G-02"] },
      { id: "AC-07/old-stale", dependsOn: ["G-01"] }
    ]
  }, {
    evidenceIds: ["AC-01/latency", "AC-02/retry", "AC-03/legacy", "AC-04/failed", "AC-05/new", "AC-06/declaration", "AC-07/old-stale"],
    contractItemIds: ["G-01", "G-02", "G-03", "G-04"]
  });
}

function invoke(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({
      exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

test("classifies added, removed, changed, and unchanged contract items by stable id", () => {
  assert.deepEqual(
    compareGoalContracts(BEFORE, AFTER).map(({ id, verdict }) => ({ id, verdict })),
    [
      { id: "G-01", verdict: "unchanged" },
      { id: "G-02", verdict: "changed" },
      { id: "G-03", verdict: "removed" },
      { id: "G-04", verdict: "added" }
    ]
  );
});

test("propagates only explicit contract dependencies and preserves all five evidence states", () => {
  const delta = createGoalDelta({
    evaluation: evaluation(),
    before: BEFORE,
    after: AFTER,
    dependencies: dependencies(),
    now: CLOCK
  });
  const byId = new Map(delta.evidence.map((item) => [item.id, item]));

  assert.equal(byId.get("AC-01/latency").status, "stale");
  assert.match(byId.get("AC-01/latency").reason, /contract-revision-changed/u);
  assert.equal(byId.get("AC-02/retry").status, "verified");
  assert.equal(byId.get("AC-03/legacy").status, "stale");
  assert.equal(byId.get("AC-03/legacy").action.kind, "retire");
  assert.match(byId.get("AC-03/legacy").reason, /contract-item-removed/u);
  assert.equal(byId.get("AC-04/failed").status, "failed");
  assert.equal(byId.get("AC-05/new").status, "missing");
  assert.equal(byId.get("AC-06/declaration").status, "declared-only");
  assert.equal(byId.get("AC-07/old-stale").status, "stale");
  assert.deepEqual([...new Set(delta.evidence.map((item) => item.status))].sort(), [
    "declared-only", "failed", "missing", "stale", "verified"
  ]);
  assert.equal(delta.summary.counts.newlyStaleEvidence, 2);
});

test("requires an explicit dependency entry for every Proofline proof line", () => {
  assert.throws(() => validateGoalDependencies({
    schemaVersion: "proofline-goal-dependencies/1",
    evidence: [{ id: "AC-01/latency", dependsOn: ["G-02"] }]
  }, {
    evidenceIds: ["AC-01/latency", "AC-02/retry"],
    contractItemIds: ["G-01", "G-02"]
  }), /explicitly map every proof line; missing: AC-02\/retry/u);
});

test("fixed clocks produce identical Goal Delta and Workprint projections", () => {
  const input = {
    evaluation: evaluation(),
    before: BEFORE,
    after: AFTER,
    dependencies: dependencies(),
    now: CLOCK
  };
  const first = createGoalDelta(input);
  const second = createGoalDelta(input);
  assert.deepEqual(first, second);
  assert.deepEqual(createWorkprintProfile(first), createWorkprintProfile(second));
  assert.equal(renderGoalDeltaHtml(first), renderGoalDeltaHtml(second));
  assert.equal(first.generatedAt, CLOCK);
});

test("Workprint projection keeps the fixed public shell and omits paths and command output", () => {
  const delta = createGoalDelta({
    evaluation: evaluation(),
    before: BEFORE,
    after: AFTER,
    dependencies: dependencies(),
    now: CLOCK
  });
  delta.title += " C:\\Users\\private\\repo";
  const profile = createWorkprintProfile(delta);
  const serialized = JSON.stringify(profile);
  assert.equal(profile.schemaVersion, "workprint-profile/0.1");
  assert.equal(profile.profile, "goal-delta");
  assert.equal(profile.findings[0].kind, "contract-change");
  assert.doesNotMatch(serialized, /C:\\\\Users/u);
  assert.doesNotMatch(serialized, /node --test|stdout|stderr/u);
});

test("self-contained HTML renders redline, fault, shockwave, reruns, and trace controls", () => {
  const html = renderGoalDeltaHtml(createGoalDelta({
    evaluation: evaluation(),
    before: BEFORE,
    after: AFTER,
    dependencies: dependencies(),
    now: CLOCK
  }));
  assert.match(html, /Revision redline/u);
  assert.match(html, /Evidence shockwave/u);
  assert.match(html, /class="rail-fault"/u);
  assert.match(html, /contract-revision-changed/u);
  assert.match(html, /data-trace-change="G-02"/u);
  assert.match(html, /@media \(max-width: 540px\)/u);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/u);
});

test("CLI writes an HTML report and deterministic Workprint profile from a verified receipt", async (t) => {
  const directory = await createTestDirectory("goal-delta-cli");
  t.after(() => removeTestDirectory(directory));
  const artifactPath = path.join(directory, "evidence", "latency.json");
  await writeJson(artifactPath, { p95Milliseconds: 1400, requestsPerSecond: 400 });
  const info = await stat(artifactPath);
  await writeJson(path.join(directory, "proofline.json"), {
    version: 1,
    project: "Checkout",
    ledger: "evidence.jsonl",
    criteria: [{
      id: "AC-01",
      statement: "The latency envelope is observed.",
      proof: [{ id: "latency", kind: "file", label: "Latency envelope", path: "evidence/latency.json" }]
    }]
  });
  await appendRecord(path.join(directory, "evidence.jsonl"), {
    schemaVersion: 1,
    eventId: "goal-delta-cli-fixture",
    criterionId: "AC-01",
    proofId: "latency",
    kind: "file",
    observed: true,
    observedAt: "2026-08-30T07:00:00.000Z",
    recordedAt: "2026-08-30T07:00:00.000Z",
    artifact: {
      path: "evidence/latency.json",
      bytes: info.size,
      modifiedAt: "2026-08-30T07:00:00.000Z",
      sha256: await sha256File(artifactPath)
    },
    environment: { label: "Windows / local fixture", platform: "win32", release: "fixture", arch: "x64", node: "v24" },
    source: "test-fixture"
  });
  await writeJson(path.join(directory, "before.json"), {
    schemaVersion: "proofline-goal-contract/1",
    title: "Checkout contract",
    revision: "checkout-v1",
    items: [{ id: "G-01", goal: "Keep checkout responsive.", acceptance: "p95 below 1800 ms." }]
  });
  await writeJson(path.join(directory, "after.json"), {
    schemaVersion: "proofline-goal-contract/1",
    title: "Checkout contract",
    revision: "checkout-v2",
    items: [{ id: "G-01", goal: "Keep checkout responsive.", acceptance: "p95 below 950 ms." }]
  });
  await writeJson(path.join(directory, "dependencies.json"), {
    schemaVersion: "proofline-goal-dependencies/1",
    evidence: [{ id: "AC-01/latency", dependsOn: ["G-01"] }]
  });

  const args = [
    "goal-delta",
    "--from", "before.json",
    "--to", "after.json",
    "--dependencies", "dependencies.json",
    "--output", "delta.html",
    "--profile-output", "delta.workprint.json",
    "--at", CLOCK
  ];
  const run = await invoke(args, directory);
  assert.equal(run.exitCode, 0, run.stderr);
  assert.match(run.stdout, /Wrote Goal Delta report/u);
  const html = await readFile(path.join(directory, "delta.html"), "utf8");
  const profile = JSON.parse(await readFile(path.join(directory, "delta.workprint.json"), "utf8"));
  assert.match(html, /verified → stale/u);
  assert.match(html, /proofline capture AC-01\/latency/u);
  assert.equal(profile.findings[0].verdict, "changed");
  assert.deepEqual(profile.findings[0].affectedEvidenceIds, ["AC-01/latency"]);
  assert.equal(profile.summary.counts.newlyStaleEvidence, 1);

  const second = await invoke([...args.slice(0, -6), "--output", "delta-2.html", "--profile-output", "delta-2.workprint.json", "--at", CLOCK], directory);
  assert.equal(second.exitCode, 0, second.stderr);
  assert.equal(
    await readFile(path.join(directory, "delta.workprint.json"), "utf8"),
    await readFile(path.join(directory, "delta-2.workprint.json"), "utf8")
  );
});
