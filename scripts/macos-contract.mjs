import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const PLUGIN_DIRECTORIES = [
  ".codex-plugin",
  "assets",
  "bin",
  "hooks",
  "schema",
  "skills",
  "src"
];

export const PLUGIN_FILES = [
  "LICENSE",
  "README.md",
  "package.json",
  "scripts/macos-activation.mjs",
  "scripts/macos-contract.mjs",
  "scripts/macos-readiness.mjs",
  "scripts/macos-readiness.sh",
  "scripts/proofline-stop.mjs"
];

export const CANDIDATE_DIRECTORIES = [
  ".codex-plugin",
  "assets",
  "bin",
  "hooks",
  "schema",
  "scripts",
  "skills",
  "src",
  "test",
  "test-support"
];

export const CANDIDATE_FILES = [
  "AGENTS.md",
  "LICENSE",
  "README.md",
  "package.json",
  "package-lock.json",
  "proofline.json"
];

export const CANDIDATE_MARKER = ".codex-proofline-macos-candidate.json";
export const ACTIVATION_CONTRACT = ".proofline/macos-activation-contract.json";
export const SKILL_RECEIPT = ".proofline/macos-skill-activation.json";
export const HOOK_RECEIPTS = ".proofline/macos-stop-hook.jsonl";
export const ACTIVATION_TOKEN = "PROOFLINE_SKILL_ACTIVE";
export const ACTIVATION_KIND = "codex-proofline-macos-activation";
export const SUPPORTED_STATES = ["verified", "missing", "stale", "declared-only", "failed"];

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(filePath) {
  return sha256(await readFile(filePath));
}

function portable(relative) {
  return relative.split(path.sep).join("/");
}

async function collectDirectory(root, relative, entries) {
  const directory = path.join(root, relative);
  const children = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const child of children) {
    const childRelative = path.join(relative, child.name);
    if (child.isDirectory()) {
      await collectDirectory(root, childRelative, entries);
    } else if (child.isFile()) {
      entries.push(childRelative);
    } else {
      throw new Error(`Candidate content cannot contain a non-file entry: ${portable(childRelative)}`);
    }
  }
}

export async function fingerprintSelection(root, directories, files) {
  const entries = [];
  for (const relative of directories) await collectDirectory(root, relative, entries);
  for (const relative of files) {
    const info = await stat(path.join(root, relative));
    if (!info.isFile()) throw new Error(`Candidate content is not a file: ${portable(relative)}`);
    entries.push(relative);
  }
  const unique = [...new Set(entries.map(portable))].sort();
  const hash = createHash("sha256");
  for (const relative of unique) {
    const content = await readFile(path.join(root, ...relative.split("/")));
    hash.update(Buffer.from(`${relative}\0${content.length}\0`, "utf8"));
    hash.update(content);
    hash.update(Buffer.from("\0", "utf8"));
  }
  return { sha256: hash.digest("hex"), files: unique.length };
}

export async function computeCandidateIdentity(root) {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const fingerprint = await fingerprintSelection(root, CANDIDATE_DIRECTORIES, CANDIDATE_FILES);
  const shortHash = fingerprint.sha256.slice(0, 16);
  const baseVersion = packageJson.version.split("+")[0];
  return {
    schemaVersion: 1,
    scope: "runtime-gate-tests-v1",
    id: `${packageJson.name}-macos-rc-${shortHash}`,
    contentSha256: fingerprint.sha256,
    contentFiles: fingerprint.files,
    installedVersion: `${baseVersion}+codex.macos-${shortHash}`
  };
}

export async function stampStagedCandidate(pluginRoot, candidate) {
  for (const relative of ["package.json", ".codex-plugin/plugin.json"]) {
    const filePath = path.join(pluginRoot, relative);
    const value = JSON.parse(await readFile(filePath, "utf8"));
    value.version = candidate.installedVersion;
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  await writeFile(
    path.join(pluginRoot, CANDIDATE_MARKER),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8"
  );
  const payload = await fingerprintSelection(
    pluginRoot,
    PLUGIN_DIRECTORIES,
    [...PLUGIN_FILES, CANDIDATE_MARKER]
  );
  return { ...candidate, installedContentSha256: payload.sha256, installedContentFiles: payload.files };
}

function sameCandidate(left, right) {
  return left?.id === right?.id &&
    left?.contentSha256 === right?.contentSha256 &&
    left?.installedVersion === right?.installedVersion;
}

export async function inspectPluginIdentity(pluginRoot) {
  const packageJson = JSON.parse(await readFile(path.join(pluginRoot, "package.json"), "utf8"));
  const pluginJson = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const marker = JSON.parse(await readFile(path.join(pluginRoot, CANDIDATE_MARKER), "utf8"));
  const payload = await fingerprintSelection(
    pluginRoot,
    PLUGIN_DIRECTORIES,
    [...PLUGIN_FILES, CANDIDATE_MARKER]
  );
  return {
    pluginName: pluginJson.name,
    packageVersion: packageJson.version,
    manifestVersion: pluginJson.version,
    candidate: marker,
    installedContentSha256: payload.sha256,
    installedContentFiles: payload.files,
    skillSha256: await sha256File(path.join(pluginRoot, "skills", "proofline", "SKILL.md")),
    activationHelperSha256: await sha256File(path.join(pluginRoot, "scripts", "macos-activation.mjs")),
    hookConfigSha256: await sha256File(path.join(pluginRoot, "hooks", "hooks.json")),
    hookScriptSha256: await sha256File(path.join(pluginRoot, "scripts", "proofline-stop.mjs"))
  };
}

export function assertPluginIdentity(identity, candidate) {
  if (identity.pluginName !== "codex-proofline") throw new Error("Installed cache has the wrong plugin name.");
  if (!sameCandidate(identity.candidate, candidate)) throw new Error("Installed cache candidate marker does not match the source candidate.");
  if (identity.packageVersion !== candidate.installedVersion || identity.manifestVersion !== candidate.installedVersion) {
    throw new Error("Installed cache package and manifest versions do not match the candidate.");
  }
  if (identity.installedContentSha256 !== candidate.installedContentSha256) {
    throw new Error("Installed cache bytes do not match the staged plugin payload.");
  }
}

export function createActivationContract(candidate, identity, activationChallenge, hookChallenge) {
  return {
    schemaVersion: 1,
    kind: ACTIVATION_KIND,
    candidate: {
      id: candidate.id,
      contentSha256: candidate.contentSha256,
      installedVersion: candidate.installedVersion,
      installedContentSha256: candidate.installedContentSha256
    },
    installed: {
      pluginName: identity.pluginName,
      skillSha256: identity.skillSha256,
      activationHelperSha256: identity.activationHelperSha256,
      hookConfigSha256: identity.hookConfigSha256,
      hookScriptSha256: identity.hookScriptSha256
    },
    activationChallenge,
    hookChallenge
  };
}

export function assertActivationContract(contract) {
  if (contract?.schemaVersion !== 1 || contract?.kind !== ACTIVATION_KIND) {
    throw new Error("Activation contract schema or kind is invalid.");
  }
  for (const [label, value] of [
    ["candidate id", contract.candidate?.id],
    ["candidate content hash", contract.candidate?.contentSha256],
    ["candidate installed version", contract.candidate?.installedVersion],
    ["installed payload hash", contract.candidate?.installedContentSha256],
    ["activation challenge", contract.activationChallenge],
    ["hook challenge", contract.hookChallenge]
  ]) {
    if (typeof value !== "string" || value.length === 0) throw new Error(`Activation contract ${label} is missing.`);
  }
  if (!/^[a-f0-9]{64}$/u.test(contract.candidate.contentSha256) ||
      !/^[a-f0-9]{64}$/u.test(contract.candidate.installedContentSha256) ||
      !/^[a-f0-9]{32}$/u.test(contract.activationChallenge) ||
      !/^[a-f0-9]{32}$/u.test(contract.hookChallenge)) {
    throw new Error("Activation contract contains an invalid digest or challenge.");
  }
  for (const key of ["skillSha256", "activationHelperSha256", "hookConfigSha256", "hookScriptSha256"]) {
    if (!/^[a-f0-9]{64}$/u.test(contract.installed?.[key] || "")) {
      throw new Error(`Activation contract ${key} is invalid.`);
    }
  }
}

function assertReceiptCandidate(receipt, contract, label) {
  if (receipt?.candidateId !== contract.candidate.id ||
      receipt?.contentSha256 !== contract.candidate.contentSha256 ||
      receipt?.installedVersion !== contract.candidate.installedVersion ||
      receipt?.installedContentSha256 !== contract.candidate.installedContentSha256) {
    throw new Error(`${label} candidate identity does not match the activation contract.`);
  }
}

export function validateFreshTaskEvidence({ finalMessage, activationReceipt, hookReceipts, contract }) {
  assertActivationContract(contract);
  if (!finalMessage.includes(ACTIVATION_TOKEN)) {
    throw new Error("Fresh task did not return the Skill-only activation token.");
  }
  if (activationReceipt?.schemaVersion !== 1 || activationReceipt?.kind !== "proofline-skill-activation") {
    throw new Error("Fresh task did not create the deterministic Skill activation receipt.");
  }
  if (activationReceipt.challenge !== contract.activationChallenge) {
    throw new Error("Skill activation receipt challenge does not match this run.");
  }
  assertReceiptCandidate(activationReceipt, contract, "Skill activation receipt");
  for (const key of ["skillSha256", "activationHelperSha256", "hookConfigSha256", "hookScriptSha256"]) {
    if (activationReceipt.installed?.[key] !== contract.installed[key]) {
      throw new Error(`Skill activation receipt ${key} does not match the installed cache.`);
    }
  }
  if (JSON.stringify(activationReceipt.supportedStates) !== JSON.stringify(SUPPORTED_STATES)) {
    throw new Error("Skill activation receipt did not preserve all five Proofline states.");
  }
  if (!Array.isArray(hookReceipts) || hookReceipts.length === 0) {
    throw new Error("Fresh task did not create a deterministic Stop hook receipt.");
  }
  for (const receipt of hookReceipts) {
    if (receipt?.schemaVersion !== 1 || receipt?.kind !== "proofline-stop-hook-activation") {
      throw new Error("Stop hook receipt schema or kind is invalid.");
    }
    if (receipt.challenge !== contract.hookChallenge || receipt.hookEventName !== "Stop") {
      throw new Error("Stop hook receipt challenge or event does not match this run.");
    }
    assertReceiptCandidate(receipt, contract, "Stop hook receipt");
    if (receipt.hookScriptSha256 !== contract.installed.hookScriptSha256 ||
        receipt.hookConfigSha256 !== contract.installed.hookConfigSha256) {
      throw new Error("Stop hook receipt does not match the installed hook bytes.");
    }
  }
  if (!hookReceipts.some((receipt) => receipt.stopHookActive === false)) {
    throw new Error("Stop hook receipts did not observe the initial Stop event.");
  }
  return {
    skillActivated: true,
    stopHookActivated: true,
    skillReceiptSha256: sha256(`${JSON.stringify(activationReceipt)}\n`),
    hookReceiptsSha256: sha256(hookReceipts.map((receipt) => JSON.stringify(receipt)).join("\n") + "\n"),
    hookInvocations: hookReceipts.length,
    modelVersionEchoRequired: false
  };
}
