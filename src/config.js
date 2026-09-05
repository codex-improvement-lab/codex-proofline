import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProoflineError } from "./errors.js";
import { evidenceRef, resolveInside } from "./util.js";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PROOF_KINDS = new Set(["command", "file", "screenshot"]);
const COMPLETION_POLICIES = new Set(["off", "warn", "enforce-once"]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProoflineError(`${label} must be an object.`, { code: "INVALID_MANIFEST" });
  }
}

function assertKnownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ProoflineError(`${label} contains unknown field: ${unknown.join(", ")}.`, {
      code: "INVALID_MANIFEST"
    });
  }
}

function assertId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new ProoflineError(
      `${label} must match ${ID_PATTERN}.`,
      { code: "INVALID_MANIFEST" }
    );
  }
}

function assertText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProoflineError(`${label} must be a non-empty string.`, {
      code: "INVALID_MANIFEST"
    });
  }
}

function assertFreshness(value, label) {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new ProoflineError(`${label} must be a positive number of hours.`, {
      code: "INVALID_MANIFEST"
    });
  }
}

export function validateManifest(manifest, root) {
  assertObject(manifest, "Manifest");
  assertKnownKeys(
    manifest,
    new Set(["$schema", "version", "project", "defaultFreshnessHours", "ledger", "completionPolicy", "criteria"]),
    "Manifest"
  );
  if (manifest.version !== 1) {
    throw new ProoflineError("Manifest version must be 1.", { code: "INVALID_MANIFEST" });
  }
  assertText(manifest.project, "project");
  assertFreshness(manifest.defaultFreshnessHours, "defaultFreshnessHours");

  const completionPolicy = manifest.completionPolicy ?? "warn";
  if (!COMPLETION_POLICIES.has(completionPolicy)) {
    throw new ProoflineError(
      "completionPolicy must be off, warn, or enforce-once.",
      { code: "INVALID_MANIFEST" }
    );
  }

  if (!Array.isArray(manifest.criteria) || manifest.criteria.length === 0) {
    throw new ProoflineError("criteria must contain at least one acceptance criterion.", {
      code: "INVALID_MANIFEST"
    });
  }

  const criterionIds = new Set();
  const references = new Set();
  for (const [criterionIndex, criterion] of manifest.criteria.entries()) {
    const criterionLabel = `criteria[${criterionIndex}]`;
    assertObject(criterion, criterionLabel);
    assertKnownKeys(criterion, new Set(["id", "statement", "proof"]), criterionLabel);
    assertId(criterion.id, `${criterionLabel}.id`);
    assertText(criterion.statement, `${criterionLabel}.statement`);
    if (criterionIds.has(criterion.id)) {
      throw new ProoflineError(`Duplicate criterion id: ${criterion.id}.`, {
        code: "INVALID_MANIFEST"
      });
    }
    criterionIds.add(criterion.id);
    if (!Array.isArray(criterion.proof) || criterion.proof.length === 0) {
      throw new ProoflineError(`${criterionLabel}.proof must not be empty.`, {
        code: "INVALID_MANIFEST"
      });
    }

    for (const [proofIndex, proof] of criterion.proof.entries()) {
      const proofLabel = `${criterionLabel}.proof[${proofIndex}]`;
      assertObject(proof, proofLabel);
      assertKnownKeys(
        proof,
        new Set(["id", "kind", "label", "path", "environment", "inputs", "freshnessHours", "expect"]),
        proofLabel
      );
      assertId(proof.id, `${proofLabel}.id`);
      assertText(proof.label, `${proofLabel}.label`);
      if (!PROOF_KINDS.has(proof.kind)) {
        throw new ProoflineError(
          `${proofLabel}.kind must be command, file, or screenshot.`,
          { code: "INVALID_MANIFEST" }
        );
      }
      const ref = evidenceRef(criterion.id, proof.id);
      if (references.has(ref)) {
        throw new ProoflineError(`Duplicate proof reference: ${ref}.`, {
          code: "INVALID_MANIFEST"
        });
      }
      references.add(ref);
      assertFreshness(proof.freshnessHours, `${proofLabel}.freshnessHours`);
      if (proof.environment !== undefined) {
        assertText(proof.environment, `${proofLabel}.environment`);
      }

      if (proof.kind === "command") {
        if (proof.path !== undefined) {
          throw new ProoflineError(
            `${ref}: command proof cannot define path.`,
            { code: "INVALID_MANIFEST" }
          );
        }
        if (proof.expect !== undefined) {
          assertObject(proof.expect, `${proofLabel}.expect`);
          assertKnownKeys(proof.expect, new Set(["exitCode"]), `${proofLabel}.expect`);
          if (
            proof.expect.exitCode !== undefined &&
            !Number.isInteger(proof.expect.exitCode)
          ) {
            throw new ProoflineError(`${ref}: expect.exitCode must be an integer.`, {
              code: "INVALID_MANIFEST"
            });
          }
        }
        if (proof.inputs !== undefined) {
          if (!Array.isArray(proof.inputs) || proof.inputs.length === 0) {
            throw new ProoflineError(`${ref}: inputs must be a non-empty array.`, {
              code: "INVALID_MANIFEST"
            });
          }
          const uniqueInputs = new Set();
          for (const [inputIndex, input] of proof.inputs.entries()) {
            assertText(input, `${proofLabel}.inputs[${inputIndex}]`);
            resolveInside(root, input, `${ref} input`);
            if (uniqueInputs.has(input)) {
              throw new ProoflineError(`${ref}: duplicate input path ${input}.`, {
                code: "INVALID_MANIFEST"
              });
            }
            uniqueInputs.add(input);
          }
        }
      } else {
        if (proof.inputs !== undefined) {
          throw new ProoflineError(`${ref}: inputs are supported only for command proof.`, {
            code: "INVALID_MANIFEST"
          });
        }
        assertText(proof.path, `${proofLabel}.path`);
        resolveInside(root, proof.path, `${ref} path`);
        if (proof.kind === "screenshot") {
          assertText(proof.environment, `${proofLabel}.environment`);
        }
      }
    }
  }

  const ledger = manifest.ledger ?? ".proofline/evidence.jsonl";
  const ledgerPath = resolveInside(root, ledger, "ledger");
  return {
    ...manifest,
    completionPolicy,
    defaultFreshnessHours: manifest.defaultFreshnessHours ?? 72,
    ledger,
    ledgerPath
  };
}

export async function loadManifest(manifestPath = "proofline.json") {
  const absolutePath = path.resolve(manifestPath);
  let raw;
  try {
    raw = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new ProoflineError(`Manifest not found: ${absolutePath}.`, {
        code: "MANIFEST_NOT_FOUND"
      });
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProoflineError(`Manifest is not valid JSON: ${error.message}`, {
      code: "INVALID_MANIFEST"
    });
  }

  const root = path.dirname(absolutePath);
  const manifest = validateManifest(parsed, root);
  const proofs = new Map();
  for (const criterion of manifest.criteria) {
    for (const proof of criterion.proof) {
      proofs.set(evidenceRef(criterion.id, proof.id), { criterion, proof });
    }
  }
  return { manifestPath: absolutePath, root, manifest, proofs };
}
