import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadManifest } from "../src/config.js";
import { evaluateProject } from "../src/evaluate.js";
import { appendRecord, environmentReceipt } from "../src/ledger.js";
import { declareClaim, observeArtifact } from "../src/observe.js";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

async function projectFor(t, value) {
  const directory = await createTestDirectory("evaluate");
  t.after(() => removeTestDirectory(directory));
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, value);
  return loadManifest(manifestPath);
}

async function appendCommand(context, overrides = {}) {
  const observedAt = overrides.observedAt ?? "2026-08-22T01:00:00.000Z";
  return appendRecord(context.manifest.ledgerPath, {
    schemaVersion: 1,
    eventId: `event-${Math.random()}`,
    criterionId: "AC-01",
    proofId: "tests",
    kind: "command",
    observed: true,
    observedAt,
    recordedAt: observedAt,
    command: ["node", "--test"],
    result: {
      exitCode: 0,
      signal: null,
      durationMs: 12,
      stdoutBytes: 2,
      stderrBytes: 0,
      stdoutSha256: "00",
      stderrSha256: "00"
    },
    environment: environmentReceipt("Windows test fixture"),
    source: "test",
    ...overrides
  });
}

test("reports missing when no evidence exists", async (t) => {
  const context = await projectFor(t, manifest());
  const result = await evaluateProject(context, { now: new Date("2026-08-22T02:00:00.000Z") });
  assert.equal(result.ready, false);
  assert.equal(result.criteria[0].proofs[0].status, "missing");
});

test("verifies a current passing command receipt", async (t) => {
  const context = await projectFor(t, manifest());
  await appendCommand(context);
  const result = await evaluateProject(context, { now: new Date("2026-08-22T02:00:00.000Z") });
  assert.equal(result.ready, true);
  assert.equal(result.criteria[0].proofs[0].status, "verified");
});

test("fails a command receipt from the wrong declared environment", async (t) => {
  const value = manifest();
  value.criteria[0].proof[0].environment = "macOS / physical device";
  const context = await projectFor(t, value);
  await appendCommand(context);
  const result = await evaluateProject(context, { now: new Date("2026-08-22T02:00:00.000Z") });
  assert.equal(result.criteria[0].proofs[0].status, "failed");
  assert.match(result.criteria[0].proofs[0].reason, /expected macOS/u);
});

test("marks nonzero command evidence failed", async (t) => {
  const context = await projectFor(t, manifest());
  await appendCommand(context, { result: { exitCode: 2 } });
  const result = await evaluateProject(context, { now: new Date("2026-08-22T02:00:00.000Z") });
  assert.equal(result.criteria[0].proofs[0].status, "failed");
  assert.match(result.criteria[0].proofs[0].reason, /exited 2/u);
});

test("marks old command evidence stale", async (t) => {
  const context = await projectFor(t, manifest());
  await appendCommand(context, { observedAt: "2026-08-20T00:00:00.000Z" });
  const result = await evaluateProject(context, { now: new Date("2026-08-22T02:00:00.000Z") });
  assert.equal(result.criteria[0].proofs[0].status, "stale");
});

test("keeps a claim declared-only", async (t) => {
  const context = await projectFor(t, manifest());
  await declareClaim(context, context.proofs.get("AC-01/tests"), "External system was unavailable.");
  const result = await evaluateProject(context);
  assert.equal(result.criteria[0].proofs[0].status, "declared-only");
});

test("verifies a file then marks it stale when bytes change", async (t) => {
  const value = manifest({
    criteria: [
      {
        id: "AC-02",
        statement: "Artifact is current.",
        proof: [{ id: "bundle", kind: "file", label: "Bundle", path: "dist/bundle.txt" }]
      }
    ]
  });
  const context = await projectFor(t, value);
  const artifactPath = path.join(context.root, "dist", "bundle.txt");
  await writeJson(artifactPath, { version: 1 });
  await observeArtifact(context, context.proofs.get("AC-02/bundle"));

  let result = await evaluateProject(context);
  assert.equal(result.criteria[0].proofs[0].status, "verified");

  await writeFile(artifactPath, "changed\n", "utf8");
  result = await evaluateProject(context);
  assert.equal(result.criteria[0].proofs[0].status, "stale");
  assert.match(result.criteria[0].proofs[0].reason, /changed after capture/u);
});

test("detects ledger tampering through the receipt hash", async (t) => {
  const context = await projectFor(t, manifest());
  await appendCommand(context);
  const raw = await readFile(context.manifest.ledgerPath, "utf8");
  await writeFile(context.manifest.ledgerPath, raw.replace('"exitCode":0', '"exitCode":9'), "utf8");
  const result = await evaluateProject(context, { now: new Date("2026-08-22T02:00:00.000Z") });
  assert.equal(result.criteria[0].proofs[0].status, "failed");
  assert.match(result.criteria[0].proofs[0].reason, /receipt hash/u);
});
