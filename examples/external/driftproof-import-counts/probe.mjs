// Original Lab probe for a publicly reported importer contract; no model calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  process.stdout.write("Usage: node probe.mjs <driftproof-checkout> [--check declared|counts|all]\nNo model, network, installation or target-file writes. Exit 0 pass, 1 unmet contract, 2 probe error.\n");
} else {
  try {
    if (![1, 3].includes(args.length) || (args.length === 3 && args[1] !== "--check")) {
      throw new Error("Supply a checkout and optional --check declared|counts|all.");
    }
    const check = args[2] ?? "all";
    if (!["declared", "counts", "all"].includes(check)) throw new Error("Unknown check.");
    const root = path.resolve(args[0]);
    const importerPath = path.join(root, "lib", "importers.js");
    const importerBytes = readFileSync(importerPath);
    const packageInfo = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

    // These guards catch accidental provider calls in this reviewed code path.
    // They are not a sandbox for arbitrary or hostile JavaScript.
    const blocked = () => { throw new Error("Unexpected network or subprocess in the offline importer probe."); };
    const child = require("node:child_process");
    for (const key of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) child[key] = blocked;
    globalThis.fetch = blocked;
    for (const protocol of ["node:http", "node:https"]) {
      const transport = require(protocol);
      transport.request = transport.get = blocked;
    }
    const { importAgentSkillsEval, importSkillgrade } = require(importerPath);
    const options = { importedAt: "2026-09-21T00:00:00.000Z" };
    const agent = importAgentSkillsEval({
      skill_name: "lab-public-count-probe", target: "gpt-4o-mini", judge: "gpt-4o-mini",
      evals: [{ id: "one", with_skill: { pass: true } }]
    }, options);
    const trials = importSkillgrade({
      skill: "lab-public-count-probe", agent: "codex",
      tasks: [{ name: "one", trials: [{ reward: 1 }, { reward: 0 }] }]
    }, options);
    const records = [agent, trials];
    const assertions = [];
    function verify(id, task) {
      try { task(); assertions.push({ id, passed: true }); }
      catch { assertions.push({ id, passed: false }); }
    }
    if (["declared", "all"].includes(check)) {
      verify("imports-stay-declared", () => assert.ok(records.every(record => record.verification_level === "DECLARED")));
      verify("imports-stay-external", () => assert.ok(records.every(record => record.run.surface === "external")));
    }
    if (["counts", "all"].includes(check)) {
      verify("absent-agent-skills-judge-count-stays-unknown", () => assert.equal(agent.run.judge.samples ?? null, null));
      verify("trial-count-is-not-judge-samples", () => assert.equal(trials.run.judge.samples ?? null, null));
      verify("observed-trial-rewards-are-preserved", () => assert.deepEqual(trials.results.cases[0].samples, [1, 0]));
    }
    const passed = assertions.every(item => item.passed);
    process.stdout.write(`${JSON.stringify({
      schemaVersion: "lab-import-count-probe/1", check, passed,
      source: { packageVersion: packageInfo.version,
        importerSha256: createHash("sha256").update(importerBytes).digest("hex") },
      observations: { sourceJudgeSampleCountSupplied: false,
        agentSkillsEvalJudgeSamples: agent.run.judge.samples ?? null,
        skillgradeJudgeSamples: trials.run.judge.samples ?? null,
        skillgradeTrialRewards: trials.results.cases[0].samples,
        verificationLevels: records.map(record => record.verification_level) },
      assertions,
      boundary: "Authored inputs against a selected upstream importer; not a live eval, full upstream gate or agent-benefit trial."
    }, null, 2)}\n`);
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: "lab-import-count-probe/1", error: "probe-error", message: error.message })}\n`);
    process.exitCode = 2;
  }
}
