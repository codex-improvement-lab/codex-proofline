import { ProoflineError } from "./errors.js";
import { STATUS_ORDER } from "./util.js";
import { applyGoalBinding, contractDigest } from "./goal-binding.js";

export function validateFilters(options) {
  if (options.status && !STATUS_ORDER.includes(options.status)) {
    throw new ProoflineError(`status must be one of: ${STATUS_ORDER.join(", ")}.`);
  }
}

export function queryGoalDelta(delta, options = {}) {
  validateFilters(options);
  if (options.item && !delta.findings.some(item => item.id === options.item)) {
    throw new ProoflineError(`Unknown contract item: ${options.item}.`);
  }
  if (options.evidence && !delta.evidence.some(item => item.id === options.evidence)) {
    throw new ProoflineError(`Unknown evidence: ${options.evidence}.`);
  }
  const evidence = delta.evidence.filter(item => (!options.status || item.status === options.status)
    && (!options.gaps || item.status !== "verified")
    && (!options.affected || item.impactedBy.length > 0)
    && (!options.item || item.dependsOn.includes(options.item))
    && (!options.evidence || item.id === options.evidence));
  const filterEvidence = options.status || options.gaps || options.evidence;
  const dependencies = new Set(evidence.flatMap(item => item.dependsOn));
  const findings = delta.findings.filter(item => (!options.item || item.id === options.item)
    && (!options.affected || item.verdict !== "unchanged")
    && (!filterEvidence || dependencies.has(item.id) || (options.gaps && delta.uncoveredAddedItems.includes(item.id))));
  return { ...delta, findings, evidence,
    query: { kind: "goal-delta", project: delta.project, baseRevision: delta.sources[0].revision,
      targetRevision: delta.sources[1].revision, summaryScope: "complete-delta",
      filters: { status: options.status ?? null, gaps: Boolean(options.gaps), affected: Boolean(options.affected),
        item: options.item ?? null, evidence: options.evidence ?? null },
      returned: { findings: findings.length, evidence: evidence.length } } };
}

export function queryEvidence(evaluation, options = {}, contract = null, dependencies = null) {
  validateFilters(options);
  const flattened = evaluation.criteria.flatMap(criterion => criterion.proofs.map(proof => ({ ...proof, criterionId: criterion.id })));
  if (options.item && !contract) throw new ProoflineError("--item requires --contract and --dependencies.");
  if (options.item && !contract.items.some(item => item.id === options.item)) throw new ProoflineError(`Unknown contract item: ${options.item}.`);
  if (options.evidence && !flattened.some(item => item.ref === options.evidence)) throw new ProoflineError(`Unknown evidence: ${options.evidence}.`);
  const mappings = new Map((dependencies?.evidence || []).map(item => [item.id, item.dependsOn]));
  const all = flattened.map(proof => {
    const dependsOn = mappings.get(proof.ref) ?? [];
    const target = contract ? applyGoalBinding(proof, evaluation.project, contract, dependsOn) : proof;
    return { id: proof.ref, criterionId: proof.criterionId, label: proof.label, kind: proof.kind,
      baseStatus: proof.status, baseReason: proof.reason, status: target.status, reason: target.reason,
      dependsOn, goalBinding: target.binding ?? null, inputTracking: proof.inputTracking,
      requirements: (contract?.intake?.requirements || []).filter(item => dependsOn.includes(item.id)),
      evidence: proof.record ? { eventId: proof.record.eventId, receipt: proof.record.receipt, observedAt: proof.record.observedAt,
        observed: proof.record.observed, source: proof.record.source } : null };
  });
  const evidence = all.filter(item => (!options.status || item.status === options.status)
    && (!options.gaps || item.status !== "verified") && (!options.evidence || item.id === options.evidence)
    && (!options.item || item.dependsOn.includes(options.item)));
  const mapped = new Set(all.flatMap(item => item.dependsOn));
  const unmappedItems = (contract?.items || []).filter(item => !mapped.has(item.id)).map(item => item.id);
  return { schemaVersion: "proofline-query/1", project: evaluation.project, generatedAt: evaluation.generatedAt,
    manifestRevision: evaluation.context.manifestRevision,
    query: { kind: contract ? "target-contract" : "local-observations", targetRevision: contract?.revision ?? null,
      contractDigest: contract ? contractDigest(contract) : null, summaryScope: "complete-project",
      intake: contract?.intake ? { scope: contract.intake.scope, revision: contract.intake.revision } : null,
      filters: { status: options.status ?? null, gaps: Boolean(options.gaps), item: options.item ?? null, evidence: options.evidence ?? null } },
    evidence, unmappedItems,
    summary: { totalEvidence: all.length, returnedEvidence: evidence.length, unmappedItems: unmappedItems.length,
      counts: Object.fromEntries(STATUS_ORDER.map(status => [status, all.filter(item => item.status === status).length])) } };
}
