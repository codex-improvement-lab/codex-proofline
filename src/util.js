import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readlink, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { ProoflineError } from "./errors.js";

export const STATUS_ORDER = [
  "verified",
  "missing",
  "stale",
  "declared-only",
  "failed"
];

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(filePath) {
  await stat(filePath);
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function collectFingerprintEntries(root, absolutePath, entries) {
  const info = await lstat(absolutePath);
  const relative = toPosixPath(path.relative(root, absolutePath)) || ".";
  if (info.isSymbolicLink()) {
    entries.push({ path: relative, type: "symlink", target: await readlink(absolutePath) });
    return;
  }
  if (info.isDirectory()) {
    entries.push({ path: relative, type: "directory" });
    const children = await readdir(absolutePath, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      await collectFingerprintEntries(root, path.join(absolutePath, child.name), entries);
    }
    return;
  }
  if (info.isFile()) {
    entries.push({
      path: relative,
      type: "file",
      bytes: info.size,
      sha256: await sha256File(absolutePath)
    });
    return;
  }
  entries.push({ path: relative, type: "other", bytes: info.size });
}

export async function fingerprintInputs(root, inputs) {
  const entries = [];
  const paths = [...inputs].map(toPosixPath).sort((left, right) => left.localeCompare(right, "en"));
  for (const input of paths) {
    await collectFingerprintEntries(root, resolveInside(root, input, "command input"), entries);
  }
  return {
    paths,
    files: entries.filter((entry) => entry.type === "file").length,
    digest: sha256Text(canonicalJson(entries))
  };
}

export function receiptFor(record) {
  const unsigned = { ...record };
  delete unsigned.receipt;
  return `sha256:${sha256Text(canonicalJson(unsigned))}`;
}

export function resolveInside(root, relativePath, label = "path") {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new ProoflineError(`${label} must be a non-empty relative path.`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new ProoflineError(`${label} must be relative to the manifest directory.`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const prefix = `${resolvedRoot}${path.sep}`;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    throw new ProoflineError(`${label} must stay inside the manifest directory.`);
  }
  return resolved;
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function shortHash(value, length = 12) {
  if (!value) return "—";
  return value.replace(/^sha256:/, "").slice(0, length);
}

export function formatAge(observedAt, now = new Date()) {
  const elapsed = Math.max(0, now.getTime() - new Date(observedAt).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "—";
  if (milliseconds < 1000) return `${milliseconds}ms`;
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function parseIsoDate(value, label = "timestamp") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ProoflineError(`${label} must be a valid ISO-8601 timestamp.`);
  }
  return parsed.toISOString();
}

export function evidenceRef(criterionId, proofId) {
  return `${criterionId}/${proofId}`;
}

export function splitEvidenceRef(value) {
  const pieces = String(value ?? "").split("/");
  if (pieces.length !== 2 || pieces.some((piece) => !piece)) {
    throw new ProoflineError(
      `Evidence reference must use <criterion>/<proof>, for example AC-01/tests.`
    );
  }
  return { criterionId: pieces[0], proofId: pieces[1] };
}
