#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest } from "../src/config.js";
import { evaluateProject } from "../src/evaluate.js";
import {
  ACTIVATION_CONTRACT,
  SKILL_RECEIPT,
  SUPPORTED_STATES,
  assertActivationContract,
  assertPluginIdentity,
  inspectPluginIdentity
} from "./macos-contract.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

async function activate(cwd = process.cwd()) {
  const workspace = path.resolve(cwd);
  const contract = JSON.parse(await readFile(path.join(workspace, ACTIVATION_CONTRACT), "utf8"));
  assertActivationContract(contract);
  const identity = await inspectPluginIdentity(PLUGIN_ROOT);
  assertPluginIdentity(identity, {
    ...contract.candidate,
    installedContentSha256: contract.candidate.installedContentSha256
  });
  for (const key of ["skillSha256", "activationHelperSha256", "hookConfigSha256", "hookScriptSha256"]) {
    if (identity[key] !== contract.installed[key]) {
      throw new Error(`Installed ${key} does not match the activation contract.`);
    }
  }

  const context = await loadManifest(path.join(workspace, "proofline.json"));
  const result = await evaluateProject(context);
  const receipt = {
    schemaVersion: 1,
    kind: "proofline-skill-activation",
    challenge: contract.activationChallenge,
    candidateId: contract.candidate.id,
    contentSha256: contract.candidate.contentSha256,
    installedVersion: identity.packageVersion,
    installedContentSha256: identity.installedContentSha256,
    installed: {
      skillSha256: identity.skillSha256,
      activationHelperSha256: identity.activationHelperSha256,
      hookConfigSha256: identity.hookConfigSha256,
      hookScriptSha256: identity.hookScriptSha256
    },
    supportedStates: SUPPORTED_STATES,
    status: {
      ready: result.ready,
      verifiedCriteria: result.summary.verifiedCriteria,
      totalCriteria: result.summary.totalCriteria,
      verifiedProofs: result.summary.verifiedProofs,
      totalProofs: result.summary.totalProofs,
      criteria: result.criteria.map((criterion) => ({ id: criterion.id, status: criterion.status }))
    }
  };
  const receiptPath = path.join(workspace, SKILL_RECEIPT);
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write("Proofline deterministic Skill activation receipt written.\n");
}

if (path.resolve(process.argv[1] || "") === SCRIPT_PATH) {
  activate().catch((error) => {
    process.stderr.write(`Proofline activation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export { activate };
