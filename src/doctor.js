import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { loadGoalContract, loadGoalDependencies } from "./goal-delta.js";
import { manifestRevision } from "./goal-binding.js";
import { resolveInside } from "./util.js";

const INPUT_CANDIDATES = ["src", "lib", "test", "tests", "bin", "scripts", "package.json", "package-lock.json", "pnpm-lock.yaml"];
export async function discoverInputs(root) {
  const present = [];
  for (const candidate of INPUT_CANDIDATES) {
    try {
      const info = await lstat(path.join(root, candidate));
      if (!info.isSymbolicLink() && (info.isFile() || info.isDirectory())) present.push(candidate);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return present;
}

export async function checkConfiguration(context, { contract: contractPath, dependencies: dependenciesPath } = {}) {
  const issues = [];
  const issue = (code, message, details = {}) => issues.push({ code, message, ...details });
  const suggestions = { inputs: await discoverInputs(context.root), commands: [] };
  try {
    const pkg = JSON.parse(await readFile(path.join(context.root, "package.json"), "utf8"));
    suggestions.commands = Object.keys(pkg.scripts || {}).sort().map(script => ({ script, command: ["npm", "run", script] }));
  } catch (error) {
    if (error.code !== "ENOENT") issue("package-metadata-unreadable", "Cannot derive script suggestions from package.json.");
  }
  for (const [id, { proof }] of context.proofs) {
    if (proof.kind !== "command") continue;
    if (!proof.inputs?.length) issue("untracked-command-inputs", "No input scope is tracked; source changes cannot invalidate this command receipt.", { evidenceId: id });
    for (const input of proof.inputs || []) {
      const absolute = resolveInside(context.root, input, "command input");
      if (context.manifest.ledgerPath === absolute || context.manifest.ledgerPath.startsWith(`${absolute}${path.sep}`)) {
        issue("input-includes-ledger", "Input scope includes the evidence ledger and will invalidate itself after recording.", { evidenceId: id, path: input });
      }
      try {
        const info = await lstat(absolute);
        if (info.isSymbolicLink()) issue("input-symlink-content-untracked", "Input fingerprint tracks the link target string, not the target contents.", { evidenceId: id, path: input });
        if (!info.isFile() && !info.isDirectory() && !info.isSymbolicLink()) issue("unsupported-input-type", "Input is not a regular file or directory.", { evidenceId: id, path: input });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        issue("input-missing", "Configured input does not exist.", { evidenceId: id, path: input });
      }
    }
  }
  let contract = null;
  if (Boolean(contractPath) !== Boolean(dependenciesPath)) {
    issue("incomplete-contract-configuration", "Supply both --contract and --dependencies.");
  } else if (!contractPath) {
    issue("contract-not-configured", "Contract associations were not checked. Supply explicit contract and dependency files.");
  } else {
    try {
      contract = await loadGoalContract(contractPath, "Target goal contract");
      const dependencies = await loadGoalDependencies(dependenciesPath, context, contract, contract);
      const mapped = new Set(dependencies.evidence.flatMap(item => item.dependsOn));
      for (const item of contract.items) {
        if (!mapped.has(item.id)) issue("contract-item-unmapped", "No evidence line declares this requirement as a dependency.", { itemId: item.id });
      }
    } catch (error) { issue("invalid-contract-association", error.message); }
  }
  return { schemaVersion: "proofline-config-check/1", project: context.manifest.project,
    manifestRevision: manifestRevision(context.manifest), targetRevision: contract?.revision ?? null,
    issues, suggestions, associationReview: "Declared mappings require human review; exit codes do not establish business coverage." };
}
