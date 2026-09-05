import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildLocalMarketplace,
  marketplaceDocument,
  resolveOutputPath,
  serializeSanitizedEvidence
} from "../scripts/macos-readiness.mjs";
import {
  ACTIVATION_CONTRACT,
  ACTIVATION_TOKEN,
  HOOK_RECEIPTS,
  SKILL_RECEIPT,
  computeCandidateIdentity,
  createActivationContract,
  inspectPluginIdentity,
  stampStagedCandidate,
  validateFreshTaskEvidence
} from "../scripts/macos-contract.mjs";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function invokeNode(script, cwd, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, stdio: ["pipe", "pipe", "pipe"] });
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
    child.stdin.end(input);
  });
}

test("builds a portable local marketplace under a path containing spaces", async (t) => {
  const directory = await createTestDirectory("marketplace with spaces");
  t.after(() => removeTestDirectory(directory));
  const marketplaceRoot = path.join(directory, "local marketplace with spaces");
  const built = await buildLocalMarketplace(ROOT, marketplaceRoot, "proofline-macos-test");
  const catalog = JSON.parse(await readFile(built.marketplacePath, "utf8"));
  const plugin = JSON.parse(await readFile(path.join(built.pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const hooks = JSON.parse(await readFile(path.join(built.pluginRoot, "hooks", "hooks.json"), "utf8"));
  const skill = await readFile(path.join(built.pluginRoot, "skills", "proofline", "SKILL.md"), "utf8");

  assert.match(built.pluginRoot, / /u);
  assert.equal(catalog.name, "proofline-macos-test");
  assert.equal(catalog.plugins[0].source.path, "./plugins/codex-proofline");
  assert.equal(catalog.plugins[0].policy.installation, "AVAILABLE");
  assert.equal(plugin.name, "codex-proofline");
  assert.equal(hooks.hooks.Stop[0].hooks[0].command, "node \"${PLUGIN_ROOT}/scripts/proofline-stop.mjs\"");
  assert.equal(hooks.hooks.Stop[0].hooks[0].commandWindows, "node \"%PLUGIN_ROOT%\\scripts\\proofline-stop.mjs\"");
  assert.match(skill, /PROOFLINE_SKILL_ACTIVE/u);
});

test("uses the complete marketplace policy shape", () => {
  const catalog = marketplaceDocument("proofline-macos-test");
  assert.deepEqual(catalog.plugins[0].policy, {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL"
  });
  assert.equal(catalog.plugins[0].category, "Productivity");
});

test("keeps gate output inside the repository and rejects leaked absolute paths", () => {
  assert.equal(resolveOutputPath(ROOT, "docs/evidence/macos-readiness.json"), path.join(ROOT, "docs", "evidence", "macos-readiness.json"));
  assert.throws(() => resolveOutputPath(ROOT, "../outside.json"), /inside the repository/u);
  assert.match(serializeSanitizedEvidence({ result: "passed" }, [ROOT]), /"passed"/u);
  assert.throws(
    () => serializeSanitizedEvidence({ leaked: ROOT }, [ROOT]),
    /absolute path/u
  );
});

test("derives a stable replacement-candidate identity from runtime, gate, and test bytes", async () => {
  const first = await computeCandidateIdentity(ROOT);
  const second = await computeCandidateIdentity(ROOT);
  assert.deepEqual(first, second);
  assert.match(first.id, /^codex-proofline-macos-rc-[a-f0-9]{16}$/u);
  assert.match(first.contentSha256, /^[a-f0-9]{64}$/u);
  assert.equal(first.installedVersion, `0.1.0+codex.macos-${first.contentSha256.slice(0, 16)}`);
  assert.ok(first.contentFiles > 30);
});

test("accepts direct Skill and hook receipts without a model version echo", async (t) => {
  const directory = await createTestDirectory("deterministic activation with spaces");
  t.after(() => removeTestDirectory(directory));
  const marketplaceRoot = path.join(directory, "local marketplace with spaces");
  const fixtureRoot = path.join(directory, "fresh task workspace with spaces");
  const built = await buildLocalMarketplace(ROOT, marketplaceRoot, "proofline-macos-test");
  let candidate = await computeCandidateIdentity(ROOT);
  candidate = await stampStagedCandidate(built.pluginRoot, candidate);
  const identity = await inspectPluginIdentity(built.pluginRoot);
  const contract = createActivationContract(
    candidate,
    identity,
    "a".repeat(32),
    "b".repeat(32)
  );
  await writeJson(path.join(fixtureRoot, "proofline.json"), manifest());
  await writeJson(path.join(fixtureRoot, ACTIVATION_CONTRACT), contract);

  const activation = await invokeNode(path.join(built.pluginRoot, "scripts", "macos-activation.mjs"), fixtureRoot);
  assert.equal(activation.exitCode, 0, activation.stderr);
  const hookInput = JSON.stringify({
    session_id: "redacted",
    turn_id: "redacted",
    cwd: fixtureRoot,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Activation probe"
  });
  const hook = await invokeNode(path.join(built.pluginRoot, "scripts", "proofline-stop.mjs"), fixtureRoot, hookInput);
  assert.equal(hook.exitCode, 0, hook.stderr);

  const activationReceipt = JSON.parse(await readFile(path.join(fixtureRoot, SKILL_RECEIPT), "utf8"));
  const hookReceipts = (await readFile(path.join(fixtureRoot, HOOK_RECEIPTS), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const finalMessage = `Five states observed. ${ACTIVATION_TOKEN}`;
  assert.equal(finalMessage.includes(candidate.installedVersion), false);
  const direct = validateFreshTaskEvidence({ finalMessage, activationReceipt, hookReceipts, contract });
  assert.equal(direct.skillActivated, true);
  assert.equal(direct.stopHookActivated, true);
  assert.equal(direct.modelVersionEchoRequired, false);

  assert.throws(
    () => validateFreshTaskEvidence({ finalMessage, activationReceipt, hookReceipts: [], contract }),
    /Stop hook receipt/u
  );
  assert.throws(
    () => validateFreshTaskEvidence({ finalMessage: "No activation token", activationReceipt, hookReceipts, contract }),
    /Skill-only activation token/u
  );
});
