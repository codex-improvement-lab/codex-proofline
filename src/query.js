import { ProoflineError } from "./errors.js";
import { STATUS_ORDER } from "./util.js";

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
