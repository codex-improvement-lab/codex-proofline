import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/proofline.js");

function invoke(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
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

test("init creates a manifest and refuses to overwrite it", async (t) => {
  const directory = await createTestDirectory("cli-init");
  t.after(() => removeTestDirectory(directory));
  const first = await invoke(["init"], directory);
  assert.equal(first.exitCode, 0);
  assert.match(first.stdout, /Created/u);
  const second = await invoke(["init"], directory);
  assert.equal(second.exitCode, 2);
  assert.match(second.stderr, /Refusing to overwrite/u);
});

test("run records command evidence and check gates readiness", async (t) => {
  const directory = await createTestDirectory("cli-run");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());

  const before = await invoke(["check"], directory);
  assert.equal(before.exitCode, 1);
  const run = await invoke([
    "run",
    "AC-01/tests",
    "--environment",
    "Windows automated test",
    "--",
    process.execPath,
    "-e",
    "process.stdout.write('ok')"
  ], directory);
  assert.equal(run.exitCode, 0, run.stderr);
  assert.match(run.stdout, /Recorded AC-01\/tests/u);
  const after = await invoke(["check", "--json"], directory);
  assert.equal(after.exitCode, 0, after.stderr);
  assert.equal(JSON.parse(after.stdout).ready, true);
});

test("run enforces an explicit command environment contract", async (t) => {
  const directory = await createTestDirectory("cli-command-environment");
  t.after(() => removeTestDirectory(directory));
  const value = manifest();
  value.criteria[0].proof[0].environment = "Windows / automated";
  await writeJson(path.join(directory, "proofline.json"), value);

  const missing = await invoke([
    "run", "AC-01/tests", "--", process.execPath, "-e", "process.exit(0)"
  ], directory);
  assert.equal(missing.exitCode, 2);
  assert.match(missing.stderr, /requires --environment/u);

  const wrong = await invoke([
    "run", "AC-01/tests", "--environment", "macOS / automated", "--",
    process.execPath, "-e", "process.exit(0)"
  ], directory);
  assert.equal(wrong.exitCode, 2);
  assert.match(wrong.stderr, /exactly match/u);

  const exact = await invoke([
    "run", "AC-01/tests", "--environment", "Windows / automated", "--",
    process.execPath, "-e", "process.exit(0)"
  ], directory);
  assert.equal(exact.exitCode, 0, exact.stderr);
});

test("configured command inputs make prior evidence stale after source changes", async (t) => {
  const directory = await createTestDirectory("cli-command-inputs");
  t.after(() => removeTestDirectory(directory));
  const value = manifest();
  value.criteria[0].proof[0].inputs = ["src.txt"];
  await writeJson(path.join(directory, "proofline.json"), value);
  await writeFile(path.join(directory, "src.txt"), "version one\n", "utf8");

  const run = await invoke([
    "run", "AC-01/tests", "--", process.execPath, "-e", "process.exit(0)"
  ], directory);
  assert.equal(run.exitCode, 0, run.stderr);
  let status = JSON.parse((await invoke(["status", "--json"], directory)).stdout);
  assert.equal(status.criteria[0].proofs[0].status, "verified");

  await writeFile(path.join(directory, "src.txt"), "version two\n", "utf8");
  status = JSON.parse((await invoke(["status", "--json"], directory)).stdout);
  assert.equal(status.criteria[0].proofs[0].status, "stale");
  assert.match(status.criteria[0].proofs[0].reason, /inputs changed/u);
});

test("runs a Windows command shim without an implicit shell mode", { skip: process.platform !== "win32" }, async (t) => {
  const directory = await createTestDirectory("cli-command-shim");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());
  const shimPath = path.join(directory, "pass.cmd");
  await writeFile(shimPath, "@echo shim-ok\r\n", "utf8");

  const run = await invoke(["run", "AC-01/tests", "--", shimPath], directory);
  assert.equal(run.exitCode, 0, run.stderr);
  assert.match(run.stdout, /shim-ok/u);
  assert.doesNotMatch(run.stderr, /DEP0190|shell option true/u);
});

test("preserves a script path and argument containing spaces as command tokens", async (t) => {
  const directory = await createTestDirectory("cli-spaced-command");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());
  const scriptPath = path.join(directory, "fixture with spaces", "probe script.mjs");
  await mkdir(path.dirname(scriptPath), { recursive: true });
  await writeFile(
    scriptPath,
    "if (process.argv[2] !== 'argument with spaces') process.exit(7); process.stdout.write('spaced-token-ok\\n');\n",
    "utf8"
  );

  const run = await invoke([
    "run",
    "AC-01/tests",
    "--",
    process.execPath,
    scriptPath,
    "argument with spaces"
  ], directory);
  assert.equal(run.exitCode, 0, run.stderr);
  assert.match(run.stdout, /spaced-token-ok/u);
});

test("records a command that cannot start as failed evidence", async (t) => {
  const directory = await createTestDirectory("cli-command-missing");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());

  const run = await invoke(["run", "AC-01/tests", "--", "proofline-command-that-does-not-exist"], directory);
  assert.equal(run.exitCode, 1);
  assert.match(run.stdout, /Recorded AC-01\/tests/u);
  const status = JSON.parse((await invoke(["status", "--json"], directory)).stdout);
  assert.equal(status.criteria[0].proofs[0].status, "failed");
  assert.match(status.criteria[0].proofs[0].reason, /could not start/u);
});

test("capture requires an exact screenshot environment", async (t) => {
  const directory = await createTestDirectory("cli-capture");
  t.after(() => removeTestDirectory(directory));
  const value = manifest({
    criteria: [
      {
        id: "AC-02",
        statement: "UI is observed.",
        proof: [{
          id: "ui",
          kind: "screenshot",
          label: "UI screenshot",
          path: "evidence/ui.png",
          environment: "Windows 11 / Edge"
        }]
      }
    ]
  });
  await writeJson(path.join(directory, "proofline.json"), value);
  await writeJson(path.join(directory, "evidence", "ui.png"), { fixture: "image bytes" });

  const missing = await invoke(["capture", "AC-02/ui"], directory);
  assert.equal(missing.exitCode, 2);
  assert.match(missing.stderr, /explicit --environment/u);
  const wrong = await invoke(["capture", "AC-02/ui", "--environment", "macOS"], directory);
  assert.equal(wrong.exitCode, 2);
  assert.match(wrong.stderr, /exactly match/u);
  const captured = await invoke([
    "capture", "AC-02/ui", "--environment", "Windows 11 / Edge"
  ], directory);
  assert.equal(captured.exitCode, 0, captured.stderr);
});

test("report writes self-contained HTML", async (t) => {
  const directory = await createTestDirectory("cli-report");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());
  const report = await invoke(["report", "--format", "html", "--output", "report.html"], directory);
  assert.equal(report.exitCode, 0, report.stderr);
  const html = await readFile(path.join(directory, "report.html"), "utf8");
  assert.match(html, /Proof, <em>not promises\.<\/em>/u);
  assert.match(html, /data-status="missing"/u);
  assert.doesNotMatch(html, /https:\/\/.*\.(css|js)/u);
});

test("JSON report exposes portable paths instead of machine-absolute paths", async (t) => {
  const directory = await createTestDirectory("cli-json-portable");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());
  const report = await invoke(["report", "--format", "json", "--output", "-"], directory);
  assert.equal(report.exitCode, 0, report.stderr);
  const json = JSON.parse(report.stdout);
  assert.equal(json.manifestPath, "proofline.json");
  assert.equal(json.ledgerPath, ".proofline/evidence.jsonl");
  assert.equal(path.isAbsolute(json.manifestPath), false);
});
