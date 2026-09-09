// Reproducible synthetic CLI interoperability check; not a user adoption study.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!["--intake", "--proofline", "--workprint", "--output"].includes(key) || !process.argv[i + 1] || options[key]) throw new Error("Supply --intake <requirements.mjs> --workprint <bin.js> --output <new-directory> [--proofline <installed-bin.js>].");
  options[key] = path.resolve(process.argv[i + 1]);
}
if (!options["--intake"] || !options["--workprint"] || !options["--output"]) throw new Error("Explicit tool paths and output are required.");
const directory = options["--output"];
const allowed = path.join(root, ".proofline", "tmp") + path.sep;
if (!directory.startsWith(allowed)) throw new Error("Keep loop artifacts in this repository's .proofline/tmp directory.");
await mkdir(path.dirname(directory), { recursive: true });
await mkdir(directory);
const proofline = options["--proofline"] ?? path.join(root, "bin", "proofline.js");
const commands = [];
function run(tool, args, label) {
  const start = performance.now();
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: directory, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  commands.push({ label, exitCode: result.status, durationMs: performance.now() - start,
    stdoutBytes: Buffer.byteLength(result.stdout || ""), stderrBytes: Buffer.byteLength(result.stderr || "") });
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout;
}
async function json(file, value) { await writeFile(path.join(directory, file), `${JSON.stringify(value, null, 2)}\n`); }
await mkdir(path.join(directory, "src"));
await mkdir(path.join(directory, "checks"));
const intakeRoot = path.resolve(path.dirname(options["--intake"]), "..");
assert.deepEqual(await readFile(path.join(intakeRoot, "src/core/requirements-schema.js")), await readFile(path.resolve(path.dirname(proofline), "../src/intake-schema.js")), "Versioned snapshot validators differ.");
for (const name of ["intake.js", "export.js"]) await copyFile(path.join(intakeRoot, "src", "core", name), path.join(directory, "src", name));
await json("package.json", { type: "module" });
await writeFile(path.join(directory, "request.txt"), "Must represent seven detected requirements.\nMust mask credentials in exports.\n");
const initial = JSON.parse(run(options["--intake"], ["prepare", "--scope", "lab-mainline", "request.txt"], "prepare requirements"));
assert.equal(initial.requirements.length, 2, "Only the two explicitly selected synthetic requirements may be confirmed.");
assert.ok(initial.requirements.every(item => item.confirmation === "candidate"));
await json("requirements-candidates.json", initial);
const reviewed = JSON.parse(run(options["--intake"], ["review", "--input", "requirements-candidates.json", "--revision", String(initial.revision),
  "--id", initial.requirements[0].id, "--id", initial.requirements[1].id, "--decision", "confirm"], "confirm two selected requirements atomically"));
await json("requirements-current.json", reviewed);
const refs = ["AC-COVERAGE/tests", "AC-PRIVACY/tests"];
await json("dependencies.json", { schemaVersion: "proofline-goal-dependencies/1",
  evidence: refs.map((id, i) => ({ id, dependsOn: [initial.requirements[i].id] })) });
await json("proofline.json", { version: 1, project: "Lab mainline synthetic CLI loop", criteria: refs.map((ref, i) => ({
  id: ref.split("/")[0], statement: i ? "Privacy export check." : "Detected signal coverage check.",
  proof: [{ id: "tests", kind: "command", label: i ? "Export privacy" : "Detected signal coverage",
    inputs: i ? ["src/intake.js", "src/export.js", "checks/privacy.mjs"] : ["src/intake.js", "checks/coverage.mjs"] }]
})) });
const coverageCheck = count => `import assert from 'node:assert/strict';
import { compileIntake } from '../src/intake.js';
const lines = Array.from({length:${count}}, (_,i) => 'Must preserve requirement ' + (i+1));
lines[lines.length-1] += ' ' + 'required context '.repeat(30) + 'FINAL-CONDITION';
const brief = compileIntake([{name:'selected.txt',kind:'text',content:lines.join('\\n')}]);
assert.equal(brief.findings.length, ${count}); assert.equal(brief.doneWhen.length, ${count});
assert.ok(brief.doneWhen.at(-1).text.includes('FINAL-CONDITION'));
`;
await writeFile(path.join(directory, "checks", "coverage.mjs"), coverageCheck(7));
await writeFile(path.join(directory, "checks", "privacy.mjs"), `import assert from 'node:assert/strict';
import { compileIntake } from '../src/intake.js'; import { toJson } from '../src/export.js';
const secret = ['synthetic','credential123'].join('');
const output = toJson(compileIntake([{name:'selected.txt',kind:'text',content:'Must mask password='+secret}]));
assert.ok(!output.includes(secret)); assert.ok(!output.includes('sourceSignal'));
`);
run(proofline, ["doctor", "--contract", "requirements-current.json", "--dependencies", "dependencies.json", "--json"], "check initial configuration");
for (const [i, ref] of refs.entries()) run(proofline, ["run", ref, "--contract", "requirements-current.json", "--dependencies", "dependencies.json", "--", process.execPath,
  i ? "checks/privacy.mjs" : "checks/coverage.mjs"], `observe ${ref}`);
const firstQuery = JSON.parse(run(proofline, ["query", "--contract", "requirements-current.json", "--dependencies", "dependencies.json"], "query initial target"));
const beforeRevision = firstQuery.query.targetRevision;
assert.equal(firstQuery.summary.counts.verified, 2);

const revised = JSON.parse(run(options["--intake"], ["review", "--input", "requirements-current.json", "--id", initial.requirements[0].id,
  "--revision", String(reviewed.revision), "--decision", "revise", "--text", "Represent thirty detected requirements and preserve every final condition."], "revise one requirement"));
assert.equal(revised.requirements[0].confirmation, "candidate");
await json("requirements-revised.json", revised);
const accepted = JSON.parse(run(options["--intake"], ["review", "--input", "requirements-revised.json", "--id", initial.requirements[0].id,
  "--revision", String(revised.revision), "--decision", "confirm"], "confirm revised requirement"));
await json("requirements-target.json", accepted);
const queryArgs = ["query", "--contract", "requirements-target.json", "--dependencies", "dependencies.json"];
const affected = JSON.parse(run(proofline, ["goal-delta", "--from", "requirements-current.json", "--to", "requirements-target.json", "--dependencies", "dependencies.json", "--json", "--gaps"], "query affected gap and bound action"));
const afterRevision = affected.query.targetRevision;
assert.equal(affected.evidence.length, 1);
assert.equal(affected.evidence[0].baseStatus, "verified");
assert.equal(affected.evidence[0].status, "stale");
assert.equal(affected.evidence[0].id, refs[0]);
await json("affected-query.json", affected);
await writeFile(path.join(directory, "checks", "coverage.mjs"), coverageCheck(30));
const proposal = affected.evidence[0].action;
assert.equal(proposal.contextComplete, true);
assert.equal(proposal.cwd, directory);
assert.equal(proposal.executable, process.execPath);
run(proposal.argv[0], proposal.argv.slice(1), "execute returned argument-array recheck");
const finalQuery = JSON.parse(run(proofline, queryArgs, "query reviewed target"));
assert.equal(finalQuery.summary.counts.verified, 2);
assert.deepEqual(finalQuery.evidence[1].evidence, firstQuery.evidence[1].evidence);
assert.equal(finalQuery.evidence[1].goalBinding.observationRevision, beforeRevision);
assert.equal(finalQuery.evidence[0].goalBinding.observationRevision, afterRevision);
await json("final-query.json", finalQuery);
const at = new Date().toISOString();
run(proofline, ["goal-delta", "--from", "requirements-current.json", "--to", "requirements-target.json", "--dependencies", "dependencies.json", "--output", "delta.html",
  "--profile-output", "profile.json", "--at", at], "export public projection");
const profile = await readFile(path.join(directory, "profile.json"), "utf8");
assert.doesNotMatch(profile, /Represent thirty|mask credentials|supportDigest|sourceSignal|previousPointer|[A-Za-z]:\\\\/);
run(options["--workprint"], ["profile", "build", "profile.json", "--out", "workprint"], "build Workprint");
run(options["--workprint"], ["profile", "verify", "workprint"], "verify Workprint");
await json("loop-result.json", { schemaVersion: "proofline-mainline-loop/1", evidenceKind: "synthetic-local-cli-interoperability",
  variant: "atomic-review-direct-input", platform: process.platform, node: process.version, beforeRevision, targetRevision: afterRevision,
  assertions: { initialCandidatesUnconfirmed: true, initialVerified: 2, changedGap: refs[0], finalVerified: 2,
    unchangedReceiptReused: true, observationRevisionsSeparate: true, privateRequirementTextOmittedFromPublicProjection: true,
    workprintBuildAndVerify: true }, commands });
process.stdout.write(`Mainline loop passed; ${commands.length} CLI operations. Recovery: ${path.join(directory, "loop-result.json")}\n`);
