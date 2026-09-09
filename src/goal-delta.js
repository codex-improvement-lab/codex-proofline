import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProoflineError } from "./errors.js";
import { canonicalJson, STATUS_ORDER } from "./util.js";
import { contractDigest, inspectGoalBinding } from "./goal-binding.js";
import { importIntake, validateIntakeOrigin } from "./intake-import.js";

export const GOAL_CONTRACT_SCHEMA = "proofline-goal-contract/1";
export const GOAL_DEPENDENCIES_SCHEMA = "proofline-goal-dependencies/1";
export const GOAL_DELTA_SCHEMA = "proofline-goal-delta/1";
export const WORKPRINT_PROFILE_SCHEMA = "workprint-profile/0.1";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+-]*$/u;
const CONTRACT_VERDICTS = ["added", "removed", "changed", "unchanged"];
const EVIDENCE_STATES = new Set(STATUS_ORDER);

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProoflineError(`${label} must be an object.`, { code: "INVALID_GOAL_DELTA" });
  }
}

function assertKnownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ProoflineError(`${label} contains unknown field: ${unknown.join(", ")}.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }
}

function assertText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProoflineError(`${label} must be a non-empty string.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }
}

function assertId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new ProoflineError(`${label} must match ${ID_PATTERN}.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }
}

async function readJson(filePath, label) {
  const absolutePath = path.resolve(filePath);
  let raw;
  try {
    raw = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new ProoflineError(`${label} not found: ${absolutePath}.`, {
        code: "GOAL_DELTA_INPUT_NOT_FOUND"
      });
    }
    throw error;
  }
  try {
    return JSON.parse(raw.replace(/^\uFEFF/u, ""));
  } catch {
    throw new ProoflineError(`${label} is not valid JSON.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }
}

export function validateGoalContract(value, label = "Goal contract") {
  assertObject(value, label);
  assertKnownKeys(
    value,
    new Set(["$schema", "schemaVersion", "title", "revision", "items", "intake"]),
    label
  );
  if (value.schemaVersion !== GOAL_CONTRACT_SCHEMA) {
    throw new ProoflineError(`${label}.schemaVersion must be ${GOAL_CONTRACT_SCHEMA}.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }
  assertText(value.title, `${label}.title`);
  if (typeof value.revision !== "string" || !REVISION_PATTERN.test(value.revision)) {
    throw new ProoflineError(
      `${label}.revision must be a portable revision token without spaces or path separators.`,
      { code: "INVALID_GOAL_DELTA" }
    );
  }
  if (!Array.isArray(value.items)) {
    throw new ProoflineError(`${label}.items must be an array.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }

  const ids = new Set();
  const items = value.items.map((item, index) => {
    const itemLabel = `${label}.items[${index}]`;
    assertObject(item, itemLabel);
    assertKnownKeys(item, new Set(["id", "goal", "acceptance"]), itemLabel);
    assertId(item.id, `${itemLabel}.id`);
    assertText(item.goal, `${itemLabel}.goal`);
    assertText(item.acceptance, `${itemLabel}.acceptance`);
    if (ids.has(item.id)) {
      throw new ProoflineError(`${label} contains duplicate item id: ${item.id}.`, {
        code: "INVALID_GOAL_DELTA"
      });
    }
    ids.add(item.id);
    return { id: item.id, goal: item.goal, acceptance: item.acceptance };
  });

  return {
    schemaVersion: value.schemaVersion,
    title: value.title,
    revision: value.revision,
    items: items.sort((left, right) => compareCodePoints(left.id, right.id)),
    ...(value.intake ? { intake: validateIntakeOrigin(value.intake, items) } : {})
  };
}

export function normalizeGoalContract(value, label = "Goal contract", { intakeOnly = false } = {}) {
  return validateGoalContract(intakeOnly || value?.schemaVersion === "intake-requirements/1" ? importIntake(value) : value, label);
}

export async function loadGoalContract(filePath, label = "Goal contract", options = {}) {
  return normalizeGoalContract(await readJson(filePath, label), label, options);
}

export function validateGoalDependencies(
  value,
  { evidenceIds, contractItemIds },
  label = "Goal dependencies"
) {
  assertObject(value, label);
  assertKnownKeys(value, new Set(["$schema", "schemaVersion", "evidence"]), label);
  if (value.schemaVersion !== GOAL_DEPENDENCIES_SCHEMA) {
    throw new ProoflineError(`${label}.schemaVersion must be ${GOAL_DEPENDENCIES_SCHEMA}.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }
  if (!Array.isArray(value.evidence)) {
    throw new ProoflineError(`${label}.evidence must be an array.`, {
      code: "INVALID_GOAL_DELTA"
    });
  }

  const expectedEvidence = new Set(evidenceIds);
  const knownContractItems = new Set(contractItemIds);
  const seenEvidence = new Set();
  const evidence = value.evidence.map((entry, index) => {
    const entryLabel = `${label}.evidence[${index}]`;
    assertObject(entry, entryLabel);
    assertKnownKeys(entry, new Set(["id", "dependsOn"]), entryLabel);
    assertText(entry.id, `${entryLabel}.id`);
    if (!expectedEvidence.has(entry.id)) {
      throw new ProoflineError(`${entryLabel}.id references unknown proof line: ${entry.id}.`, {
        code: "INVALID_GOAL_DELTA"
      });
    }
    if (seenEvidence.has(entry.id)) {
      throw new ProoflineError(`${label} contains duplicate evidence id: ${entry.id}.`, {
        code: "INVALID_GOAL_DELTA"
      });
    }
    seenEvidence.add(entry.id);
    if (!Array.isArray(entry.dependsOn) || entry.dependsOn.length === 0) {
      throw new ProoflineError(`${entryLabel}.dependsOn must be a non-empty array.`, {
        code: "INVALID_GOAL_DELTA"
      });
    }
    const seenDependencies = new Set();
    const dependsOn = entry.dependsOn.map((itemId, dependencyIndex) => {
      assertId(itemId, `${entryLabel}.dependsOn[${dependencyIndex}]`);
      if (!knownContractItems.has(itemId)) {
        throw new ProoflineError(`${entryLabel} references unknown contract item: ${itemId}.`, {
          code: "INVALID_GOAL_DELTA"
        });
      }
      if (seenDependencies.has(itemId)) {
        throw new ProoflineError(`${entryLabel} repeats contract item: ${itemId}.`, {
          code: "INVALID_GOAL_DELTA"
        });
      }
      seenDependencies.add(itemId);
      return itemId;
    });
    return {
      id: entry.id,
      dependsOn: dependsOn.sort(compareCodePoints)
    };
  });

  const missing = [...expectedEvidence]
    .filter((evidenceId) => !seenEvidence.has(evidenceId))
    .sort(compareCodePoints);
  if (missing.length > 0) {
    throw new ProoflineError(
      `${label} must explicitly map every proof line; missing: ${missing.join(", ")}.`,
      { code: "INVALID_GOAL_DELTA" }
    );
  }

  return {
    schemaVersion: value.schemaVersion,
    evidence: evidence.sort((left, right) => compareCodePoints(left.id, right.id))
  };
}

export async function loadGoalDependencies(filePath, context, before, after) {
  const evidenceIds = [...context.proofs.keys()];
  const contractItemIds = [
    ...new Set([...before.items, ...after.items].map((item) => item.id))
  ];
  return validateGoalDependencies(
    await readJson(filePath, "Goal dependencies"),
    { evidenceIds, contractItemIds }
  );
}

export function compareGoalContracts(before, after) {
  if (before.revision === after.revision) {
    throw new ProoflineError("Goal contract revisions must be different.", {
      code: "INVALID_GOAL_DELTA"
    });
  }
  const beforeById = new Map(before.items.map((item) => [item.id, item]));
  const afterById = new Map(after.items.map((item) => [item.id, item]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort(compareCodePoints);
  return ids.map((id) => {
    const previous = beforeById.get(id) ?? null;
    const current = afterById.get(id) ?? null;
    let verdict;
    if (!previous) verdict = "added";
    else if (!current) verdict = "removed";
    else if (canonicalJson(previous) === canonicalJson(current)) verdict = "unchanged";
    else verdict = "changed";
    return { id, verdict, before: previous, after: current };
  });
}

function impactCode(verdict) {
  return {
    added: "contract-item-added",
    removed: "contract-item-removed",
    changed: "contract-revision-changed"
  }[verdict];
}

function recheckExecution(proof, target, context) {
  const requiredContext = ["executable", "cliPath", "cwd", "manifestPath", "contractPath", "dependenciesPath"]
    .filter(key => typeof context?.[key] !== "string" || !path.isAbsolute(context[key]));
  const command = proof.record?.command;
  if (proof.kind === "command" && (!Array.isArray(command) || !command.length || command.some(token => typeof token !== "string") || !command[0])) {
    requiredContext.push("command");
  }
  const digest = contractDigest(target);
  if (requiredContext.length) return { command: null, executable: null, argv: null, cwd: null,
    contextComplete: false, requiredContext, targetRevision: target.revision, contractDigest: digest };
  const argv = [context.cliPath, proof.kind === "command" ? "run" : "capture", proof.ref,
    "--manifest", context.manifestPath, "--contract", context.contractPath, "--dependencies", context.dependenciesPath,
    "--contract-digest", digest];
  const environment = proof.environment ?? proof.record?.environment?.label;
  if (environment) argv.push("--environment", environment);
  if (proof.kind === "command") argv.push("--", ...command);
  return { command: null, executable: context.executable, argv, cwd: context.cwd,
    contextComplete: true, requiredContext: [], targetRevision: target.revision, contractDigest: digest };
}

function contractReason(changes, targetRevision, bound = false) {
  const details = changes.map((change) => `${change.id} ${change.verdict}`).join(", ");
  const codes = [...new Set(changes.map((change) => impactCode(change.verdict)))];
  return bound ? `Contract delta ${details} (${codes.join(", ")}); the current receipt binds these dependencies for ${targetRevision}.`
    : `Contract delta ${details} (${codes.join(", ")}); evidence must be reconsidered for ${targetRevision}.`;
}

function publicText(value) {
  return String(value)
    .replace(/[A-Za-z]:[\\/][^\s,;]+/gu, "[absolute path redacted]")
    .replace(/(^|\s)\/(?:Users|home|private|tmp|var)\/[^\s,;]+/gu, "$1[absolute path redacted]");
}

function flattenEvidence(evaluation) {
  return evaluation.criteria.flatMap((criterion) => criterion.proofs.map((proof) => ({
    ...proof,
    criterionId: criterion.id,
    criterionStatement: criterion.statement
  })));
}

function changeCounts(changes) {
  return Object.fromEntries(CONTRACT_VERDICTS.map((verdict) => [
    verdict,
    changes.filter((change) => change.verdict === verdict).length
  ]));
}

export function createGoalDelta({ evaluation, before, after, dependencies, now, executionContext = null }) {
  const generatedAt = new Date(now ?? evaluation.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    throw new ProoflineError("Goal Delta clock must be a valid ISO-8601 timestamp.", {
      code: "INVALID_GOAL_DELTA"
    });
  }
  const changes = compareGoalContracts(before, after);
  const changesById = new Map(changes.map((change) => [change.id, change]));
  const dependenciesByEvidence = new Map(
    dependencies.evidence.map((entry) => [entry.id, entry.dependsOn])
  );
  const flattened = flattenEvidence(evaluation);

  const evidence = flattened
    .map((proof) => {
      if (!EVIDENCE_STATES.has(proof.status)) {
        throw new ProoflineError(`Unknown Proofline evidence state: ${proof.status}.`, {
          code: "INVALID_GOAL_DELTA"
        });
      }
      const dependsOn = dependenciesByEvidence.get(proof.ref);
      if (!dependsOn) {
        throw new ProoflineError(`Goal dependencies are missing proof line: ${proof.ref}.`, {
          code: "INVALID_GOAL_DELTA"
        });
      }
      const impacts = dependsOn
        .map((itemId) => changesById.get(itemId))
        .filter((change) => change && change.verdict !== "unchanged");
      const binding = inspectGoalBinding(proof.record, evaluation.project, after, dependsOn);
      const contractImpactReason = impacts.length > 0
        ? contractReason(impacts, after.revision, binding.compatible)
        : null;
      let status = proof.status;
      let reason = proof.reason;
      const bindingMismatch = proof.record?.goalBinding && !binding.compatible;
      if (((impacts.length > 0 && !binding.compatible) || bindingMismatch) && (proof.status === "verified" || proof.status === "stale")) {
        status = "stale";
        const explanation = contractImpactReason ?? `${binding.code}: reconsider the declared dependencies for ${after.revision}.`;
        reason = proof.status === "verified"
          ? explanation
          : `${proof.reason} ${explanation}`;
      }
      const removedOnly = dependsOn.every(id => !after.items.some(item => item.id === id));
      const action = (impacts.length === 0 && !bindingMismatch) || (binding.compatible && status === "verified")
        ? null
        : removedOnly
          ? {
              kind: "retire",
              label: `Retire ${proof.ref}; every declared dependency was removed from ${after.revision}.`,
              command: null
            }
          : {
              kind: proof.record?.observed ? "rerun" : "observe",
              label: `${proof.record?.observed ? "Re-run" : "Observe"} ${proof.ref} against ${after.revision}.`,
              ...recheckExecution(proof, after, executionContext)
            };
      return {
        id: proof.ref,
        label: proof.label,
        kind: proof.kind,
        criterionId: proof.criterionId,
        criterionStatement: proof.criterionStatement,
        dependsOn,
        goalBinding: binding,
        inputTracking: proof.inputTracking ?? null,
        evidence: proof.record ? { eventId: proof.record.eventId ?? null, receipt: proof.record.receipt ?? null,
          observedAt: proof.record.observedAt ?? null, observed: proof.record.observed } : null,
        baseStatus: proof.status,
        baseReason: proof.reason,
        status,
        reason,
        contractImpactReason,
        impactCodes: [...new Set(impacts.map((impact) => impactCode(impact.verdict)))],
        impactedBy: impacts.map((impact) => ({ id: impact.id, verdict: impact.verdict })),
        action
      };
    })
    .sort((left, right) => compareCodePoints(left.id, right.id));

  const evidenceByContractItem = new Map();
  for (const item of before.items.concat(after.items)) evidenceByContractItem.set(item.id, new Set());
  for (const entry of dependencies.evidence) {
    for (const itemId of entry.dependsOn) evidenceByContractItem.get(itemId)?.add(entry.id);
  }
  const findings = changes.map((change) => ({
    ...change,
    affectedEvidenceIds: change.verdict === "unchanged"
      ? []
      : [...(evidenceByContractItem.get(change.id) ?? [])].sort(compareCodePoints)
  }));
  const counts = changeCounts(findings);
  const materialChanges = counts.added + counts.removed + counts.changed;
  const affectedEvidence = evidence.filter((proof) => proof.impactedBy.length > 0);
  const newlyStaleEvidence = evidence.filter(
    (proof) => proof.baseStatus === "verified" && proof.status === "stale"
  );
  const usableEvidence = evidence.filter((proof) => proof.status === "verified");
  const rerunEvidence = evidence.filter((proof) => proof.action?.kind === "rerun");
  const retireEvidence = evidence.filter((proof) => proof.action?.kind === "retire");
  const addedItems = findings.filter((finding) => finding.verdict === "added");
  const uncoveredAddedItems = addedItems.filter(
    (finding) => finding.affectedEvidenceIds.length === 0
  );
  const headline = newlyStaleEvidence.length > 0
    ? `${materialChanges} contract ${materialChanges === 1 ? "change makes" : "changes make"} ${newlyStaleEvidence.length} previously verified proof ${newlyStaleEvidence.length === 1 ? "line" : "lines"} stale.`
    : materialChanges > 0
      ? `${materialChanges} contract ${materialChanges === 1 ? "change" : "changes"}; ${usableEvidence.length} proof ${usableEvidence.length === 1 ? "line is" : "lines are"} currently usable under the target comparison.`
      : "No material contract change; existing evidence keeps its current Proofline state.";

  return {
    schemaVersion: GOAL_DELTA_SCHEMA,
    project: evaluation.project,
    title: `Goal Delta · ${after.title}`,
    generatedAt: generatedAt.toISOString(),
    context: { kind: "goal-delta", manifestRevision: evaluation.context?.manifestRevision ?? null,
      baseRevision: before.revision, targetRevision: after.revision,
      baseStatusMeaning: "Current local observation state, not a historical evaluation of the prior contract.",
      legacyReceiptPolicy: "Unbound receipts are compared under the explicitly supplied prior contract; new receipts can bind their dependencies." },
    sourceRevision: `${before.revision}..${after.revision}`,
    sources: [
      { id: "contract-before", label: before.title, revision: before.revision },
      { id: "contract-after", label: after.title, revision: after.revision }
    ],
    findings,
    evidence,
    uncoveredAddedItems: uncoveredAddedItems.map((finding) => finding.id),
    summary: {
      headline,
      counts: {
        ...counts,
        affectedEvidence: affectedEvidence.length,
        newlyStaleEvidence: newlyStaleEvidence.length,
        usableEvidence: usableEvidence.length,
        rerunEvidence: rerunEvidence.length,
        retireEvidence: retireEvidence.length,
        uncoveredAddedItems: uncoveredAddedItems.length
      },
      beforeVerifiedEvidence: evaluation.summary.verifiedProofs,
      afterVerifiedEvidence: usableEvidence.length,
      totalEvidence: evidence.length
    }
  };
}

export function createWorkprintProfile(delta) {
  const sourceRefsFor = (verdict) => {
    if (verdict === "added") return ["contract-after"];
    if (verdict === "removed") return ["contract-before"];
    return ["contract-before", "contract-after"];
  };
  return {
    schemaVersion: WORKPRINT_PROFILE_SCHEMA,
    profile: "goal-delta",
    title: publicText(delta.title),
    sourceRevision: delta.sourceRevision,
    sources: delta.sources.map((source) => ({
      id: source.id,
      label: publicText(source.label),
      revision: source.revision
    })),
    findings: delta.findings.map((finding) => ({
      id: `goal-delta-${finding.id}`,
      kind: "contract-change",
      verdict: finding.verdict,
      subject: publicText(`${finding.id} · ${(finding.after ?? finding.before).goal}`),
      sourceRefs: sourceRefsFor(finding.verdict),
      affectedEvidenceIds: finding.affectedEvidenceIds
    })),
    summary: {
      headline: publicText(delta.summary.headline),
      counts: { ...delta.summary.counts }
    }
  };
}
