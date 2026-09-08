import { ProoflineError } from "./errors.js";
import { canonicalJson, sha256Text } from "./util.js";

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const STATES = new Set(["candidate", "user-confirmed", "needs-review", "withdrawn"]);
const fail = message => { throw new ProoflineError(message, { code: "INVALID_INTAKE_REQUIREMENTS" }); };
const positive = value => Number.isSafeInteger(value) && value > 0;
function pointer(value) {
  if (!value || typeof value.sourceId !== "string" || !TOKEN.test(value.sourceId)
    || typeof value.locator !== "string" || !value.locator.trim()
    || (value.sourceId !== "USER" && !positive(value.sourceRevision))) fail("Invalid Intake source pointer.");
  return { sourceId: value.sourceId, ...(value.sourceId === "USER" ? {} : { sourceRevision: value.sourceRevision }), locator: value.locator };
}

export function validateIntakeOrigin(value, items) {
  if (!value || value.schemaVersion !== "proofline-intake-origin/1" || typeof value.scope !== "string" || value.scope.length > 64 || !TOKEN.test(value.scope || "")
    || !positive(value.revision) || !Array.isArray(value.requirements)) fail("Invalid Intake origin metadata.");
  const ids = new Set();
  const requirements = value.requirements.map(item => {
    if (!TOKEN.test(item.id || "") || !item.id.startsWith(`${value.scope}-R`) || ids.has(item.id)
      || !positive(item.revision) || !STATES.has(item.confirmation)) fail("Invalid Intake identity, revision or confirmation.");
    ids.add(item.id);
    return { id: item.id, revision: item.revision, confirmation: item.confirmation, pointer: pointer(item.pointer),
      ...(item.previousPointer ? { previousPointer: pointer(item.previousPointer) } : {}) };
  });
  const confirmed = requirements.filter(item => item.confirmation === "user-confirmed").map(item => item.id).sort();
  if (canonicalJson(confirmed) !== canonicalJson(items.map(item => item.id).sort())) {
    fail("Goal items must correspond exactly to current confirmed Intake requirements.");
  }
  return { schemaVersion: value.schemaVersion, scope: value.scope, revision: value.revision, requirements };
}

export function importIntake(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== "intake-requirements/1" || !Array.isArray(snapshot.requirements)) fail("Expected an intake-requirements/1 snapshot.");
  const items = snapshot.requirements.filter(item => item.confirmation === "user-confirmed").map(item => {
    if (typeof item.text !== "string" || !item.text.trim() || !/^[a-f0-9]{64}$/u.test(item.supportDigest || "")) fail("Confirmed requirement text/support digest is missing.");
    return { id: item.id, goal: `Reviewed requirement ${item.id}`,
      acceptance: `${item.text}\nIntake requirement ${item.id} revision ${item.revision}; support sha256:${item.supportDigest}.` };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const intake = validateIntakeOrigin({ schemaVersion: "proofline-intake-origin/1", scope: snapshot.scope,
    revision: snapshot.revision, requirements: snapshot.requirements }, items);
  const digest = sha256Text(canonicalJson({ intake, items }));
  return { schemaVersion: "proofline-goal-contract/1", title: `Intake ${intake.scope}`,
    revision: `${intake.scope}.r${intake.revision}-${digest.slice(0, 12)}`, items, intake };
}
