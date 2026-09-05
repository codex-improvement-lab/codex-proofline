import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadManifest } from "../src/config.js";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

test("loads a valid manifest and indexes proof references", async (t) => {
  const directory = await createTestDirectory("config-valid");
  t.after(() => removeTestDirectory(directory));
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, manifest());

  const context = await loadManifest(manifestPath);
  assert.equal(context.manifest.project, "Test project");
  assert.equal(context.manifest.ledger, ".proofline/evidence.jsonl");
  assert.equal(context.proofs.get("AC-01/tests").proof.kind, "command");
});

test("rejects duplicate proof references", async (t) => {
  const directory = await createTestDirectory("config-duplicate");
  t.after(() => removeTestDirectory(directory));
  const value = manifest();
  value.criteria[0].proof.push({ ...value.criteria[0].proof[0] });
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, value);

  await assert.rejects(() => loadManifest(manifestPath), /Duplicate proof reference/u);
});

test("rejects unknown fields instead of silently ignoring typos", async (t) => {
  const directory = await createTestDirectory("config-unknown");
  t.after(() => removeTestDirectory(directory));
  const value = manifest();
  value.criteria[0].proof[0].freshnessHour = 24;
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, value);

  await assert.rejects(() => loadManifest(manifestPath), /unknown field: freshnessHour/u);
});

test("rejects artifact paths that escape the manifest root", async (t) => {
  const directory = await createTestDirectory("config-escape");
  t.after(() => removeTestDirectory(directory));
  const value = manifest({
    criteria: [
      {
        id: "AC-01",
        statement: "Artifact stays scoped.",
        proof: [{ id: "artifact", kind: "file", label: "Artifact", path: "../secret.txt" }]
      }
    ]
  });
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, value);

  await assert.rejects(() => loadManifest(manifestPath), /must stay inside/u);
});

test("rejects command input paths that escape the manifest root", async (t) => {
  const directory = await createTestDirectory("config-input-escape");
  t.after(() => removeTestDirectory(directory));
  const value = manifest();
  value.criteria[0].proof[0].inputs = ["../outside.txt"];
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, value);

  await assert.rejects(() => loadManifest(manifestPath), /must stay inside/u);
});

test("requires explicit environment contracts for screenshots", async (t) => {
  const directory = await createTestDirectory("config-screenshot");
  t.after(() => removeTestDirectory(directory));
  const value = manifest({
    criteria: [
      {
        id: "AC-01",
        statement: "Visual result is observed.",
        proof: [{ id: "ui", kind: "screenshot", label: "UI", path: "ui.png" }]
      }
    ]
  });
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, value);

  await assert.rejects(() => loadManifest(manifestPath), /environment must be a non-empty/u);
});
