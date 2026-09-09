// Versioned intake-requirements/1 validation, with no runtime dependencies.
// Canonical copy: codex-intake/src/core/requirements-schema.js.
// Proofline vendors this file so each repository remains independently installable.
export const REQUIREMENTS_SCHEMA = "intake-requirements/1";
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const STATES = new Set(["candidate", "user-confirmed", "needs-review", "withdrawn"]);
const positive = value => Number.isSafeInteger(value) && value > 0;
const hash = (value, length) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
function fields(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new Error("Unsupported fields in requirement snapshot; raw content and extensions are not accepted.");
  }
}
function sourceKey(source) { return `${source.id}@${source.revision}`; }

export function validateRequirements(value) {
  fields(value, ["schemaVersion", "scope", "revision", "nextId", "nextSourceId", "requirements", "sources", "sourceHistory"]);
  if (value.schemaVersion !== REQUIREMENTS_SCHEMA || typeof value.scope !== "string" || value.scope.length > 64 || !TOKEN.test(value.scope)
    || !positive(value.revision) || !positive(value.nextId) || (value.nextSourceId !== undefined && !positive(value.nextSourceId))
    || !Array.isArray(value.requirements) || !Array.isArray(value.sources) || !Array.isArray(value.sourceHistory)) {
    throw new Error("Invalid intake-requirements/1 snapshot.");
  }
  const current = new Set(), revisions = new Set(), currentIds = new Set();
  for (const [collection, entries] of [["sources", value.sources], ["sourceHistory", value.sourceHistory]]) {
    for (const source of entries) {
      fields(source, ["id", "revision", "name", "kind", "lineCount", "digest", "digestAlgorithm"]);
      if (typeof source.id !== "string" || !/^S\d{2,6}$/.test(source.id) || Number(source.id.slice(1)) < 1 || !positive(source.revision)
        || typeof source.name !== "string" || !Number.isSafeInteger(source.lineCount) || source.lineCount < 0
        || !["text", "log", "file-list", "screenshot", "url"].includes(source.kind)
        || !["sha256", "fnv1a32"].includes(source.digestAlgorithm)
        || !hash(source.digest, source.digestAlgorithm === "sha256" ? 64 : 8)) throw new Error("Invalid source metadata.");
      const key = sourceKey(source);
      if (revisions.has(key) || (collection === "sources" && currentIds.has(source.id))) throw new Error("Duplicate source identity or revision.");
      revisions.add(key);
      if (collection === "sources") { current.add(key); currentIds.add(source.id); }
    }
  }
  const ids = new Set();
  for (const item of value.requirements) {
    fields(item, ["id", "revision", "identityKey", "supportDigest", "supportKind", "text", "confirmation", "authorship", "pointer", "previousPointer", "disposition", "ambiguous"]);
    if (typeof item.id !== "string" || !TOKEN.test(item.id) || !item.id.startsWith(`${value.scope}-R`) || ids.has(item.id)
      || !positive(item.revision) || !STATES.has(item.confirmation) || typeof item.text !== "string" || !item.text.trim()
      || !hash(item.identityKey, 64) || !hash(item.supportDigest, 64)
      || !["rule-derived", "user-edited", "user-authored"].includes(item.authorship)
      || (item.supportKind !== undefined && !["full-signal", "metadata"].includes(item.supportKind))
      || (item.ambiguous !== undefined && typeof item.ambiguous !== "boolean")
      || (item.disposition !== undefined && (typeof item.disposition !== "string" || !item.disposition.trim()))) {
      throw new Error("Invalid or duplicate requirement identity/state.");
    }
    ids.add(item.id);
    if (!item.pointer) throw new Error(`Missing source pointer for ${item.id}.`);
    for (const ref of [item.pointer, ...(item.previousPointer === undefined ? [] : [item.previousPointer])]) {
      fields(ref, ["sourceId", "sourceRevision", "locator", "excerpt"]);
      if (typeof ref.sourceId !== "string" || typeof ref.locator !== "string" || !ref.locator.trim()
        || (ref.excerpt !== undefined && typeof ref.excerpt !== "string")
        || (ref.sourceId === "USER" ? ref.sourceRevision !== undefined : !positive(ref.sourceRevision) || !revisions.has(`${ref.sourceId}@${ref.sourceRevision}`))) {
        throw new Error(`Unknown or invalid source revision for ${item.id}.`);
      }
    }
    if (item.pointer.sourceId === "USER" && item.authorship !== "user-authored") throw new Error("Manual pointers require user-authored requirements.");
    if (item.confirmation === "user-confirmed" && item.pointer.sourceId !== "USER" && !current.has(`${item.pointer.sourceId}@${item.pointer.sourceRevision}`)) {
      throw new Error("An old-source requirement cannot be confirmed as current; use an explicit keep decision.");
    }
  }
  return value;
}
