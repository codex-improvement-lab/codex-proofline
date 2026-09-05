import { stat } from "node:fs/promises";
import path from "node:path";
import { latestRecords, readLedger } from "./ledger.js";
import {
  evidenceRef,
  fingerprintInputs,
  receiptFor,
  resolveInside,
  sha256File,
  STATUS_ORDER,
  toPosixPath
} from "./util.js";

function result(status, reason, record = null, details = {}) {
  return { status, reason, record, details };
}

async function evaluateProof(context, criterion, proof, record, now) {
  if (!record) return result("missing", "No evidence has been recorded.");
  if (record.receipt !== receiptFor(record)) {
    return result("failed", "Ledger receipt hash does not match the record.", record);
  }
  if (record.observed === false || record.kind === "claim") {
    return result(
      "declared-only",
      record.note ? `Declared, not observed: ${record.note}` : "Declared, not observed.",
      record
    );
  }
  if (record.kind !== proof.kind) {
    return result(
      "failed",
      `Expected ${proof.kind} evidence but latest record is ${record.kind}.`,
      record
    );
  }

  const observedAt = new Date(record.observedAt);
  if (Number.isNaN(observedAt.getTime())) {
    return result("failed", "Evidence has an invalid observedAt timestamp.", record);
  }
  if (observedAt.getTime() - now.getTime() > 5 * 60_000) {
    return result("failed", "Evidence timestamp is more than five minutes in the future.", record);
  }
  if (proof.environment && record.environment?.label !== proof.environment) {
    return result(
      "failed",
      `Environment label ${record.environment?.label ?? "is missing"}; expected ${proof.environment}.`,
      record
    );
  }

  if (proof.kind === "command") {
    const expectedExitCode = proof.expect?.exitCode ?? 0;
    if (record.result?.exitCode !== expectedExitCode) {
      const outcome = record.result?.errorCode
        ? `Command could not start (${record.result.errorCode})`
        : `Command exited ${record.result?.exitCode ?? "without a code"}`;
      return result(
        "failed",
        `${outcome}; expected exit ${expectedExitCode}.`,
        record
      );
    }
    if (proof.inputs) {
      if (!record.inputs?.digest) {
        return result("failed", "Command receipt is missing its configured input fingerprint.", record);
      }
      let currentInputs;
      try {
        currentInputs = await fingerprintInputs(context.root, proof.inputs);
      } catch (error) {
        if (error.code === "ENOENT") {
          return result("stale", "A configured command input is now missing.", record);
        }
        throw error;
      }
      if (currentInputs.digest !== record.inputs.digest) {
        return result(
          "stale",
          "Configured command inputs changed after the command ran.",
          record,
          { currentInputDigest: currentInputs.digest }
        );
      }
    }
  } else {
    const expectedPath = toPosixPath(proof.path);
    if (record.artifact?.path !== expectedPath) {
      return result(
        "failed",
        `Receipt path ${record.artifact?.path ?? "is missing"}; expected ${expectedPath}.`,
        record
      );
    }
    const absolutePath = resolveInside(context.root, proof.path, `${evidenceRef(criterion.id, proof.id)} path`);
    let currentStat;
    let currentHash;
    try {
      currentStat = await stat(absolutePath);
      currentHash = await sha256File(absolutePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return result("missing", `Artifact is missing: ${proof.path}.`, record);
      }
      throw error;
    }
    if (!currentStat.isFile()) {
      return result("failed", `Artifact is not a file: ${proof.path}.`, record);
    }
    if (currentHash !== record.artifact?.sha256) {
      return result(
        "stale",
        `Artifact changed after capture: ${proof.path}.`,
        record,
        { currentHash }
      );
    }
  }

  const freshnessHours = proof.freshnessHours ?? context.manifest.defaultFreshnessHours;
  const ageMilliseconds = now.getTime() - observedAt.getTime();
  if (ageMilliseconds > freshnessHours * 60 * 60_000) {
    return result(
      "stale",
      `Evidence is older than ${freshnessHours}h.`,
      record,
      { ageMilliseconds, freshnessHours }
    );
  }
  return result("verified", "Observed evidence is present, current, and passing.", record, {
    freshnessHours
  });
}

function criterionStatus(proofs) {
  if (proofs.every((proof) => proof.status === "verified")) return "verified";
  for (const status of ["failed", "stale", "declared-only", "missing"]) {
    if (proofs.some((proof) => proof.status === status)) return status;
  }
  return "missing";
}

export async function evaluateProject(context, { now = new Date() } = {}) {
  const records = await readLedger(context.manifest.ledgerPath);
  const latest = latestRecords(records);
  const criteria = [];

  for (const criterion of context.manifest.criteria) {
    const proofs = [];
    for (const proof of criterion.proof) {
      const ref = evidenceRef(criterion.id, proof.id);
      const evaluation = await evaluateProof(
        context,
        criterion,
        proof,
        latest.get(ref),
        now
      );
      proofs.push({ ...proof, ref, ...evaluation });
    }
    criteria.push({
      id: criterion.id,
      statement: criterion.statement,
      status: criterionStatus(proofs),
      proofs
    });
  }

  const proofCounts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  const criterionCounts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  for (const criterion of criteria) {
    criterionCounts[criterion.status] += 1;
    for (const proof of criterion.proofs) proofCounts[proof.status] += 1;
  }
  const totalProofs = criteria.reduce((sum, criterion) => sum + criterion.proofs.length, 0);
  const verifiedCriteria = criterionCounts.verified;
  return {
    schemaVersion: 1,
    project: context.manifest.project,
    manifestPath: path.basename(context.manifestPath),
    ledgerPath: context.manifest.ledger,
    generatedAt: now.toISOString(),
    ready: verifiedCriteria === criteria.length,
    readinessPercent: Math.round((verifiedCriteria / criteria.length) * 100),
    criteria,
    summary: {
      totalCriteria: criteria.length,
      verifiedCriteria,
      totalProofs,
      verifiedProofs: proofCounts.verified,
      criterionCounts,
      proofCounts
    }
  };
}
