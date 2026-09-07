import { canonicalJson, sha256Text } from "./util.js";

export const contractDigest = contract => sha256Text(canonicalJson(contract));
export const manifestRevision = manifest => {
  const { ledgerPath, ...portable } = manifest;
  return `sha256:${sha256Text(canonicalJson(portable))}`;
};
export const proofRevision = (criterion, proof) => sha256Text(canonicalJson({
  criterionId: criterion.id, statement: criterion.statement, proof
}));

export function bindGoal(project, contract, dependsOn) {
  const byId = new Map(contract.items.map(item => [item.id, item]));
  return { schemaVersion: "proofline-goal-binding/1", project, revision: contract.revision,
    contractDigest: contractDigest(contract),
    dependencies: [...dependsOn].sort().map(id => ({ id, digest: sha256Text(canonicalJson(byId.get(id))) })) };
}

export function inspectGoalBinding(record, project, contract, dependsOn) {
  const binding = record?.goalBinding;
  const observationRevision = binding?.revision ?? null;
  const outcome = (compatible, code) => ({ compatible, code, observationRevision, targetRevision: contract.revision });
  if (!binding || binding.schemaVersion !== "proofline-goal-binding/1") return outcome(false, "contract-binding-missing");
  if (binding.project !== project) return outcome(false, "contract-project-changed");
  if (!dependsOn.every(id => contract.items.some(item => item.id === id))) return outcome(false, "contract-item-removed");
  const current = bindGoal(project, contract, dependsOn);
  if (canonicalJson(binding.dependencies) !== canonicalJson(current.dependencies)) return outcome(false, "contract-dependencies-changed");
  return outcome(true, null);
}

export function applyGoalBinding(proof, project, contract, dependsOn) {
  const binding = inspectGoalBinding(proof.record, project, contract, dependsOn);
  const stale = !binding.compatible && ["verified", "stale"].includes(proof.status);
  return { binding, status: stale ? "stale" : proof.status,
    reason: stale ? `${proof.reason} ${binding.code}: receipt does not bind the current dependencies for ${contract.revision}.` : proof.reason };
}
