import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/proofline.js");
const GOAL_EXAMPLE = path.resolve(path.dirname(BIN), "../examples/goal-delta/checkout-shockwave");
const goalArgs = () => ["goal-delta", "--manifest", path.join(GOAL_EXAMPLE, "proofline.json"),
  "--from", path.join(GOAL_EXAMPLE, "contracts/before.json"), "--to", path.join(GOAL_EXAMPLE, "contracts/after.json"),
  "--dependencies", path.join(GOAL_EXAMPLE, "dependencies.json"), "--at", "2026-08-30T08:00:00.000Z"];

test("goal-delta JSON is a complete read-only document with target revision context", async (t) => {
  const directory = await createTestDirectory("goal-json");
  t.after(() => removeTestDirectory(directory));
  const result = await invoke([...goalArgs(), "--json"], directory);
  assert.equal(result.exitCode, 0, result.stderr);
  const delta = JSON.parse(result.stdout);
  assert.equal(delta.schemaVersion, "proofline-goal-delta/1");
  assert.equal(delta.summary.beforeVerifiedEvidence, 4);
  assert.equal(delta.summary.afterVerifiedEvidence, 2);
  assert.equal(delta.evidence.filter(item => item.status === "stale").length, 2);
  assert.equal(delta.query.targetRevision, delta.sources[1].revision);
  assert.equal(delta.query.summaryScope, "complete-delta");
  assert.deepEqual(await readdir(directory), []);
});

test("goal-delta JSON filters keep base state, dependencies and global counts", async (t) => {
  const directory = await createTestDirectory("goal-json-filter");
  t.after(() => removeTestDirectory(directory));
  const result = await invoke([...goalArgs(), "--json", "--gaps", "--item", "PERF-01"], directory);
  assert.equal(result.exitCode, 0, result.stderr);
  const delta = JSON.parse(result.stdout);
  assert.equal(delta.evidence.length, 2);
  assert.equal(delta.findings.length, 1);
  assert.ok(delta.evidence.every(item => item.baseStatus === "verified" && item.status === "stale" && item.dependsOn.includes("PERF-01")));
  assert.equal(delta.summary.totalEvidence, 4);
  assert.deepEqual(await readdir(directory), []);
});

test("goal-delta rejects unsupported or conflicting options before writing", async (t) => {
  const directory = await createTestDirectory("goal-json-options");
  t.after(() => removeTestDirectory(directory));
  for (const tail of [["--json", "--output", "out.html"], ["--format", "html"], ["--json", "--status", "green"],
    ["--gaps"], ["--json", "--item", "UNKNOWN"], ["--json", "--json"]]) {
    const result = await invoke([...goalArgs(), ...tail], directory);
    assert.equal(result.exitCode, 2, result.stdout);
    assert.equal(result.stdout, "");
    assert.notEqual(result.stderr, "");
    assert.deepEqual(await readdir(directory), []);
  }
});

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
  const initial = JSON.parse(await readFile(path.join(directory, "proofline.json"), "utf8"));
  assert.deepEqual(initial.criteria.flatMap(item => item.proof.map(proof => proof.kind)), ["command", "screenshot"]);
  const second = await invoke(["init"], directory);
  assert.equal(second.exitCode, 2);
  assert.match(second.stderr, /Refusing to overwrite/u);
});

test("command-only init completes a headless evidence loop and keeps source invalidation", async (t) => {
  const directory = await createTestDirectory("cli-command-only");
  t.after(() => removeTestDirectory(directory));
  const project = path.join(directory, "headless project");
  await mkdir(path.join(project, "src"), { recursive: true });
  const input = path.join(project, "src", "result.txt");
  await writeFile(input, "ready", "utf8");
  const initialized = await invoke(["init", project, "--command-only"], directory);
  assert.equal(initialized.exitCode, 0, initialized.stderr);
  const original = await readFile(path.join(project, "proofline.json"), "utf8");
  const initial = JSON.parse(original);
  assert.equal(initial.criteria.length, 1);
  assert.deepEqual(initial.criteria[0].proof[0].inputs, ["src"]);
  assert.equal((await invoke(["check", "--json"], project)).exitCode, 1);
  const runArgs = ["run", "AC-01/tests", "--", process.execPath, "-e",
    "require('node:assert/strict').equal(require('node:fs').readFileSync('src/result.txt', 'utf8'), 'ready')"];
  const observed = await invoke(runArgs, project);
  assert.equal(observed.exitCode, 0, observed.stderr);
  const ready = await invoke(["check", "--json"], project);
  assert.equal(ready.exitCode, 0, ready.stderr);
  assert.equal(JSON.parse(ready.stdout).summary.verifiedProofs, 1);
  await writeFile(input, "changed", "utf8");
  const stale = await invoke(["check", "--json"], project);
  assert.equal(stale.exitCode, 1);
  assert.equal(JSON.parse(stale.stdout).criteria[0].proofs[0].status, "stale");
  assert.equal((await invoke(runArgs, project)).exitCode, 1);
  const failed = await invoke(["check", "--json"], project);
  assert.equal(failed.exitCode, 1);
  assert.equal(JSON.parse(failed.stdout).criteria[0].proofs[0].status, "failed");
  assert.equal((await invoke(["init", "--command-only"], project)).exitCode, 2);
  assert.equal(await readFile(path.join(project, "proofline.json"), "utf8"), original);
});

test("command-only is explicit, scoped to init and rejects duplicates without writing", async (t) => {
  const directory = await createTestDirectory("cli-command-only-options");
  t.after(() => removeTestDirectory(directory));
  for (const args of [["init", "--command-only", "--command-only"], ["status", "--command-only"],
    ["init", "--command-only", "--output", "unexpected.json"]]) {
    assert.equal((await invoke(args, directory)).exitCode, 2);
    assert.deepEqual(await readdir(directory), []);
  }
});

test("init prefills only present conventional inputs; doctor exposes configuration omissions", async (t) => {
  const directory = await createTestDirectory("doctor");
  t.after(() => removeTestDirectory(directory));
  await mkdir(path.join(directory, "src"));
  await writeJson(path.join(directory, "package.json"), { scripts: { test: "node --test" } });
  assert.equal((await invoke(["init"], directory)).exitCode, 0);
  const initial = JSON.parse(await readFile(path.join(directory, "proofline.json"), "utf8"));
  assert.deepEqual(initial.criteria[0].proof[0].inputs, ["src", "package.json"]);
  let checked = await invoke(["doctor", "--json"], directory);
  assert.equal(checked.exitCode, 1);
  assert.deepEqual(JSON.parse(checked.stdout).issues.map(issue => issue.code), ["contract-not-configured"]);
  const value = manifest();
  await writeJson(path.join(directory, "proofline.json"), value);
  checked = await invoke(["doctor", "--json"], directory);
  assert.ok(JSON.parse(checked.stdout).issues.some(issue => issue.code === "untracked-command-inputs"));
  value.criteria[0].proof[0].inputs = ["not-present", "."];
  await writeJson(path.join(directory, "proofline.json"), value);
  checked = await invoke(["doctor", "--json"], directory);
  assert.ok(JSON.parse(checked.stdout).issues.some(issue => issue.code === "input-missing"));
  assert.ok(JSON.parse(checked.stdout).issues.some(issue => issue.code === "input-includes-ledger"));
});

test("target queries require dependency-bound observations, preserve unrelated evidence and admit explicit reruns", async (t) => {
  const directory = await createTestDirectory("bound-query");
  t.after(() => removeTestDirectory(directory));
  const value = manifest();
  value.criteria[0].proof[0].inputs = ["src.txt"];
  value.criteria.push({ id: "AC-02", statement: "Independent check.", proof: [{ ...value.criteria[0].proof[0] }] });
  await writeJson(path.join(directory, "proofline.json"), value);
  await writeFile(path.join(directory, "src.txt"), "source bytes", "utf8");
  const before = { schemaVersion: "proofline-goal-contract/1", title: "Maintenance", revision: "r1", items: [
    { id: "G1", goal: "Preserve all signals", acceptance: "Seven signals are represented." },
    { id: "G2", goal: "Preserve privacy", acceptance: "No credential appears." }
  ] };
  const after = structuredClone(before);
  after.revision = "r2";
  after.items[0].acceptance = "Thirty signals and full text are represented.";
  await writeJson(path.join(directory, "before.json"), before);
  await writeJson(path.join(directory, "after.json"), after);
  const dependencies = { schemaVersion: "proofline-goal-dependencies/1", evidence: [
    { id: "AC-01/tests", dependsOn: ["G1"] }, { id: "AC-02/tests", dependsOn: ["G2"] }
  ] };
  await writeJson(path.join(directory, "deps.json"), dependencies);
  const run = (ref, contract) => invoke(["run", ref, ...(contract ? ["--contract", contract, "--dependencies", "deps.json"] : []),
    "--", process.execPath, "-e", "process.exit(0)"], directory);
  const query = async (contract, extra = []) => {
    const output = await invoke(["query", "--contract", contract, "--dependencies", "deps.json", ...extra], directory);
    assert.equal(output.exitCode, 0, output.stderr);
    return JSON.parse(output.stdout);
  };
  assert.equal((await run("AC-01/tests")).exitCode, 0);
  let queried = await query("before.json");
  assert.equal(queried.evidence[0].baseStatus, "verified");
  assert.equal(queried.evidence[0].status, "stale");
  assert.equal(queried.evidence[0].goalBinding.code, "contract-binding-missing");
  assert.equal((await run("AC-01/tests", "before.json")).exitCode, 0);
  assert.equal((await run("AC-02/tests", "before.json")).exitCode, 0);
  queried = await query("after.json");
  assert.deepEqual(queried.evidence.map(item => item.status), ["stale", "verified"]);
  assert.equal(queried.query.targetRevision, "r2");
  assert.equal(queried.evidence[1].goalBinding.observationRevision, "r1");
  assert.equal(queried.evidence[1].inputTracking.mode, "tracked");
  assert.equal(typeof queried.evidence[1].evidence.receipt, "string");
  assert.doesNotMatch(JSON.stringify(queried), /process.exit|stdoutSha256|"command":/u);
  assert.equal((await query("after.json", ["--gaps", "--item", "G1"])).evidence.length, 1);
  assert.equal((await run("AC-01/tests", "after.json")).exitCode, 0);
  assert.equal((await query("after.json", ["--gaps"])).evidence.length, 0);
  const deltaRun = await invoke(["goal-delta", "--from", "before.json", "--to", "after.json", "--dependencies", "deps.json", "--json"], directory);
  const delta = JSON.parse(deltaRun.stdout);
  assert.equal(delta.evidence[0].status, "verified");
  assert.equal(delta.evidence[0].action, null);
  assert.equal(delta.evidence[0].impactedBy.length, 1);
  assert.match(delta.evidence[0].contractImpactReason, /current receipt binds/);
  assert.doesNotMatch(delta.evidence[0].contractImpactReason, /must be reconsidered/);
  value.criteria[0].statement = "A revised acceptance statement.";
  await writeJson(path.join(directory, "proofline.json"), value);
  assert.equal((await query("after.json")).evidence[0].baseStatus, "stale");
});

test("doctor reports unmapped requirements and rejects broken associations without executing", async (t) => {
  const directory = await createTestDirectory("doctor-mapping");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());
  await writeJson(path.join(directory, "contract.json"), { schemaVersion: "proofline-goal-contract/1", title: "Task", revision: "r1",
    items: ["G1", "G2"].map(id => ({ id, goal: id, acceptance: id })) });
  await writeJson(path.join(directory, "deps.json"), { schemaVersion: "proofline-goal-dependencies/1", evidence: [{ id: "AC-01/tests", dependsOn: ["G1"] }] });
  let result = JSON.parse((await invoke(["doctor", "--json", "--contract", "contract.json", "--dependencies", "deps.json"], directory)).stdout);
  assert.ok(result.issues.some(item => item.code === "contract-item-unmapped" && item.itemId === "G2"));
  await writeJson(path.join(directory, "deps.json"), { schemaVersion: "proofline-goal-dependencies/1", evidence: [] });
  result = JSON.parse((await invoke(["doctor", "--json", "--contract", "contract.json", "--dependencies", "deps.json"], directory)).stdout);
  assert.ok(result.issues.some(item => item.code === "invalid-contract-association"));
  assert.ok(!(await readdir(directory)).includes(".proofline"));
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
