import { access, appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest } from "../src/config.js";
import { evaluateProject } from "../src/evaluate.js";
import {
  ACTIVATION_CONTRACT,
  HOOK_RECEIPTS,
  assertActivationContract,
  assertPluginIdentity,
  inspectPluginIdentity
} from "./macos-contract.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function appendActivationReceipt(input, cwd) {
  const contractPath = path.join(cwd, ACTIVATION_CONTRACT);
  let raw;
  try {
    raw = await readFile(contractPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const contract = JSON.parse(raw);
  assertActivationContract(contract);
  const identity = await inspectPluginIdentity(PLUGIN_ROOT);
  assertPluginIdentity(identity, {
    ...contract.candidate,
    installedContentSha256: contract.candidate.installedContentSha256
  });
  if (identity.hookScriptSha256 !== contract.installed.hookScriptSha256 ||
      identity.hookConfigSha256 !== contract.installed.hookConfigSha256) {
    throw new Error("Installed Stop hook bytes do not match the activation contract.");
  }
  const receipt = {
    schemaVersion: 1,
    kind: "proofline-stop-hook-activation",
    challenge: contract.hookChallenge,
    candidateId: contract.candidate.id,
    contentSha256: contract.candidate.contentSha256,
    installedVersion: identity.packageVersion,
    installedContentSha256: identity.installedContentSha256,
    hookScriptSha256: identity.hookScriptSha256,
    hookConfigSha256: identity.hookConfigSha256,
    hookEventName: input.hook_event_name,
    stopHookActive: input.stop_hook_active === true
  };
  await appendFile(path.join(cwd, HOOK_RECEIPTS), `${JSON.stringify(receipt)}\n`, "utf8");
}

try {
  const input = await readStdin();
  const cwd = path.resolve(input.cwd || process.cwd());
  await appendActivationReceipt(input, cwd);
  const manifestPath = path.join(cwd, "proofline.json");
  try {
    await access(manifestPath);
  } catch {
    emit({});
    process.exit(0);
  }

  const context = await loadManifest(manifestPath);
  if (context.manifest.completionPolicy === "off") {
    emit({});
    process.exit(0);
  }
  const result = await evaluateProject(context);
  const summary = `Proofline: ${result.summary.verifiedCriteria}/${result.summary.totalCriteria} acceptance criteria and ${result.summary.verifiedProofs}/${result.summary.totalProofs} proof lines are verified.`;
  if (result.ready) {
    emit({ systemMessage: `${summary} Evidence gate is ready.` });
    process.exit(0);
  }

  const gaps = result.criteria
    .filter((criterion) => criterion.status !== "verified")
    .map((criterion) => `${criterion.id}:${criterion.status}`)
    .join(", ");
  const reason = `${summary} Gaps: ${gaps}. Before saying done, collect observable evidence with Proofline or record an honest declared-only claim for external work.`;
  if (context.manifest.completionPolicy === "enforce-once" && !input.stop_hook_active) {
    emit({ decision: "block", reason });
  } else {
    emit({ systemMessage: reason });
  }
} catch (error) {
  emit({ systemMessage: `Proofline could not evaluate this workspace: ${error.message}` });
}
