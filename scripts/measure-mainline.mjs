// Implements docs/MAINLINE_EVALUATION_PROTOCOL.md. No network or model calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const opts = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!["--intake-root", "--output"].includes(key) || !process.argv[i + 1] || opts[key]) throw new Error("Use --intake-root <checkout> --output <new .proofline/tmp directory>.");
  opts[key] = path.resolve(process.argv[i + 1]);
}
if (!opts["--intake-root"] || !opts["--output"] || !opts["--output"].startsWith(path.join(root, ".proofline", "tmp") + path.sep)) throw new Error("Explicit Intake checkout and repository-local scratch directory required.");
const directory = opts["--output"];
await mkdir(path.dirname(directory), { recursive: true });
await mkdir(directory);
const hash = value => createHash("sha256").update(value).digest("hex");
const intake = path.join(opts["--intake-root"], "scripts", "requirements.mjs");
const proofline = path.join(root, "bin", "proofline.js");
function gitFile(ref) {
  const result = spawnSync("git", ["show", `${ref}:src/core/intake.js`], { cwd: opts["--intake-root"], encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const oldSource = gitFile("88cc6abf548b1b5a3fb8dfd6213c76df923aa3da");
const fixedSource = gitFile("fe4002b");
await writeFile(path.join(directory, "pre-fix-intake.js"), oldSource);
await writeFile(path.join(directory, "fixed-intake.js"), fixedSource);
const requirements = ["Must represent seven detected requirements.", "Must mask credentials."];
const coverageCheck = count => `import assert from 'node:assert/strict';
import { compileIntake } from './intake.js';
const lines=Array.from({length:${count}},(_,i)=>'Must preserve requirement '+(i+1));
${count === 30 ? "lines[29]+=' '+ 'necessary context '.repeat(30)+'FINAL-CONDITION';" : ""}
const b=compileIntake([{name:'request.txt',kind:'text',content:lines.join('\\n')}]);
assert.equal(b.findings.length,${count}); assert.equal(b.doneWhen.length,${count});
${count === 30 ? "assert.ok(b.doneWhen[29].text.includes('FINAL-CONDITION'));" : ""}
`;
const privacyCheck = `import assert from 'node:assert/strict'; import {redactText} from './intake.js';
const secret=['synthetic','credential123'].join(''); assert.ok(!redactText('${["pass", "word"].join("")}='+secret).includes(secret));
`;
// A compact baseline helper makes explicit what a careful file-based handoff
// records. It is authored/configured once, counted below, and never forces reruns.
const baselineHelper = `import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto'; import {spawnSync} from 'node:child_process';
const hash=x=>createHash('sha256').update(x).digest('hex');
const definitions=JSON.parse(await readFile('baseline-contract.json','utf8'));
let receipts={}; try{receipts=JSON.parse(await readFile('handoff.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
async function signature(d){return hash(JSON.stringify({acceptance:d.acceptance,inputs:await Promise.all(d.inputs.map(async f=>[f,hash(await readFile(f))]))}));}
const [action,id]=process.argv.slice(2);
if(action==='run'){
 const d=definitions.find(d=>d.id===id); if(!d)throw new Error('Unknown check');
 const signatureBefore=await signature(d); const r=spawnSync(process.execPath,[d.check],{encoding:'utf8'});
 receipts[id]={signature:signatureBefore,exitCode:r.status,executionId:hash(JSON.stringify([id,Date.now(),process.pid])),observedRequirement:d.acceptance};
 await writeFile('handoff.json',JSON.stringify(receipts,null,2)+'\\n'); process.stdout.write(JSON.stringify(receipts[id])+'\\n'); process.exitCode=r.status;
}else if(action==='audit'){
 const rows=await Promise.all(definitions.map(async d=>({id:d.id,current:receipts[d.id]?.exitCode===0&&receipts[d.id]?.signature===await signature(d),executionId:receipts[d.id]?.executionId??null})));
 process.stdout.write(JSON.stringify({gaps:rows.filter(r=>!r.current).map(r=>r.id),rows})+'\\n');
}else throw new Error('Unknown action');
`;
const operations = [], phases = [];
let mode, phase, cwd;
async function write(name, body, kind = "configuration") {
  const start = performance.now();
  await writeFile(path.join(cwd, name), typeof body === "string" ? body : `${JSON.stringify(body, null, 2)}\n`);
  operations.push({ mode, phase, kind, label: name, wallMs: performance.now() - start, command: false, exitCode: 0 });
}
function run(entry, args, label, expected = 0, verification = false) {
  const start = performance.now();
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  operations.push({ mode, phase, kind: verification ? "verification" : "query-or-review", label,
    wallMs: performance.now() - start, command: true, verification, exitCode: result.status, expectedExitCode: expected,
    stdoutBytes: Buffer.byteLength(result.stdout || ""), stderrBytes: Buffer.byteLength(result.stderr || "") });
  assert.equal(result.status, expected, `${label}: ${result.stderr}`);
  return JSON.parse(result.stdout.trim().startsWith("{") ? result.stdout : "null");
}
async function timed(name, body) {
  phase = name;
  const start = performance.now();
  const first = operations.length;
  await body();
  const used = operations.slice(first);
  phases.push({ mode, phase, harnessWallMs: performance.now() - start,
    subprocessWallMs: used.filter(item => item.command).reduce((sum, item) => sum + item.wallMs, 0),
    operations: used.length, commandInvocations: used.filter(item => item.command).length,
    configurationOrMaintenanceWrites: used.filter(item => !item.command && item.kind !== "oracle").length,
    verificationExecutions: used.filter(item => item.verification).length,
    expectedFailedCommands: used.filter(item => item.command && item.exitCode !== 0 && item.exitCode === item.expectedExitCode).length,
    unexpectedRetries: 0 });
}
const refs = ["AC-COVERAGE/tests", "AC-PRIVACY/tests"];
const baselineDefinitions = [
  { id: refs[0], acceptance: requirements[0], check: "coverage.mjs", inputs: ["intake.js", "coverage.mjs"] },
  { id: refs[1], acceptance: requirements[1], check: "privacy.mjs", inputs: ["intake.js", "privacy.mjs"] }
];
const correctness = [];
for (mode of ["baseline", "assisted"]) {
  cwd = path.join(directory, mode);
  await mkdir(cwd);
  // Shared supplied start material: identical and separately listed, not charged
  // only to one workflow as configuration.
  for (const [name, text] of Object.entries({ "package.json": '{"type":"module"}', "request.txt": requirements.join("\n"),
    "intake.js": oldSource, "coverage.mjs": coverageCheck(7), "privacy.mjs": privacyCheck })) await writeFile(path.join(cwd, name), text);
  let target, initialPrivacy;
  await timed("initial-configuration", async () => {
    if (mode === "baseline") {
      await write("baseline-check.mjs", baselineHelper);
      await write("baseline-contract.json", baselineDefinitions);
    } else {
      const prepared = run(intake, ["prepare", "--scope", "replay", "request.txt"], "prepare requirements");
      await write("candidates.json", prepared);
      target = prepared;
      for (const requirement of prepared.requirements) {
        await write("review-input.json", target);
        target = run(intake, ["review", "--input", "review-input.json", "--id", requirement.id, "--decision", "confirm"], "confirm requirement");
      }
      await write("reviewed.json", target);
      const contract = run(proofline, ["import-intake", "--input", "reviewed.json"], "import confirmed requirements");
      await write("contract.json", contract);
      await write("dependencies.json", { schemaVersion: "proofline-goal-dependencies/1", evidence: refs.map((id, i) => ({ id, dependsOn: [prepared.requirements[i].id] })) });
      await write("proofline.json", { version: 1, project: "Internal maintenance replay", criteria: refs.map((ref, i) => ({ id: ref.split("/")[0], statement: baselineDefinitions[i].acceptance,
        proof: [{ id: "tests", kind: "command", label: baselineDefinitions[i].check, inputs: baselineDefinitions[i].inputs }] })) });
      run(proofline, ["doctor", "--contract", "contract.json", "--dependencies", "dependencies.json", "--json"], "check configuration");
    }
  });
  const verify = (index, expected = 0) => mode === "baseline"
    ? run(path.join(cwd, "baseline-check.mjs"), ["run", refs[index]], `verify ${refs[index]}`, expected, true)
    : run(proofline, ["run", refs[index], "--contract", "contract.json", "--dependencies", "dependencies.json", "--", process.execPath, baselineDefinitions[index].check], `verify ${refs[index]}`, expected, true);
  const audit = () => {
    if (mode === "baseline") return run(path.join(cwd, "baseline-check.mjs"), ["audit"], "audit saved handoff");
    const queried = run(proofline, ["query", "--contract", "contract.json", "--dependencies", "dependencies.json"], "query explicit target");
    return { gaps: queried.evidence.filter(item => item.status !== "verified").map(item => item.id),
      rows: queried.evidence.map(item => ({ id: item.id, current: item.status === "verified", executionId: item.evidence?.eventId ?? null })) };
  };
  await timed("defect-fix-acceptance", async () => {
    verify(0, 1);
    await write("intake.js", fixedSource, "known-fix-application");
    verify(0);
    verify(1);
    const checked = audit();
    assert.deepEqual(checked.gaps, []);
    initialPrivacy = checked.rows[1].executionId;
    correctness.push({ mode, task: phase, reproducedKnownFailure: true, finalGaps: [], falseNegatives: 0, falsePositives: 0 });
  });
  await timed("acceptance-change-maintenance", async () => {
    if (mode === "baseline") {
      const changed = structuredClone(baselineDefinitions);
      changed[0].acceptance = "Represent thirty detected requirements and preserve every final condition.";
      await write("baseline-contract.json", changed, "requirement-maintenance");
    } else {
      const revised = run(intake, ["review", "--input", "reviewed.json", "--id", target.requirements[0].id, "--decision", "revise",
        "--text", "Represent thirty detected requirements and preserve every final condition."], "revise acceptance");
      await write("revised-candidate.json", revised, "requirement-maintenance");
      const confirmed = run(intake, ["review", "--input", "revised-candidate.json", "--id", target.requirements[0].id, "--decision", "confirm"], "confirm revised acceptance");
      await write("revised-confirmed.json", confirmed, "requirement-maintenance");
      const contract = run(proofline, ["import-intake", "--input", "revised-confirmed.json"], "import revised acceptance");
      await write("contract.json", contract, "requirement-maintenance");
    }
    // The same oracle is used before editing/running the changed test.
    const affected = audit();
    assert.deepEqual(affected.gaps, [refs[0]]);
    assert.equal(affected.rows[1].executionId, initialPrivacy);
    await write("coverage.mjs", coverageCheck(30), "test-maintenance");
    verify(0);
    const checked = audit();
    assert.deepEqual(checked.gaps, []);
    assert.equal(checked.rows[1].executionId, initialPrivacy);
    correctness.push({ mode, task: phase, affected: [refs[0]], unaffectedEvidenceReused: true, finalGaps: [], falseNegatives: 0, falsePositives: 0 });
  });
  await timed("later-session-handoff", async () => {
    const destination = path.join(directory, `${mode}-handoff`);
    const start = performance.now();
    await cp(cwd, destination, { recursive: true, errorOnExist: true, force: false });
    operations.push({ mode, phase, kind: "handoff-copy", label: "copy saved task files to fresh directory", wallMs: performance.now() - start, command: false, exitCode: 0 });
    cwd = destination;
    const checked = audit();
    assert.deepEqual(checked.gaps, []);
    assert.equal(checked.rows[1].executionId, initialPrivacy);
    assert.equal(hash(await readFile(path.join(cwd, "intake.js"))), hash(fixedSource));
    correctness.push({ mode, task: phase, reconstructedFromFiles: true, repeatedUnchangedChecks: 0, finalGaps: [], falseNegatives: 0, falsePositives: 0 });
  });
}
const report = { schemaVersion: "proofline-mainline-measurement/1", evidenceKind: "non-blind-controlled-internal-maintenance-replay",
  protocol: "docs/MAINLINE_EVALUATION_PROTOCOL.md", platform: process.platform, node: process.version,
  materials: { beforeCommit: "88cc6abf548b1b5a3fb8dfd6213c76df923aa3da", fixedCommit: "fe4002b",
    beforeSourceSha256: hash(oldSource), fixedSourceSha256: hash(fixedSource), baselineHelperSha256: hash(baselineHelper),
    sharedInitialFiles: ["package.json", "request.txt", "intake.js", "coverage.mjs", "privacy.mjs"] },
  measurementLimits: { humanTime: "unavailable", activeAgentInvestigationTime: "unavailable", modelTokens: "unavailable",
    contextTokens: "unavailable", developmentAndDebuggingCost: "outside replay; not a total development cost comparison",
    timingMeaning: "harness/subprocess wall time only; shared host, one ordered pair, no statistical or causal user-saving claim" },
  phases, correctness, operations };
await writeFile(path.join(directory, "measurement.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(JSON.stringify({ phases, correctness, report: path.join(directory, "measurement.json") }, null, 2) + "\n");
