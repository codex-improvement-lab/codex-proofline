import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeCandidateIdentity } from "./macos-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = [
  ".codex-plugin/plugin.json",
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "PROOFLINE_REPORT.md",
  "README.md",
  "RELEASE_CHECKLIST.md",
  "RELEASE_NOTES.md",
  "SECURITY.md",
  "assets/screenshot-1.png",
  "docs/EXTENSION_SURFACE.md",
  "docs/MACOS_HANDOFF.md",
  "docs/NATIVE_PRODUCT_PROPOSAL.md",
  "docs/PRODUCT_INSIGHTS.md",
  "docs/VERIFICATION.md",
  "docs/evidence/macos-replacement-candidate.json",
  "docs/evidence/goal-delta-desktop.png",
  "docs/evidence/goal-delta-mobile.png",
  "docs/evidence/goal-delta-trace.png",
  "docs/evidence/proofline-overview.png",
  "docs/evidence/proofline-mobile.png",
  "examples/goal-delta/README.md",
  "examples/goal-delta/checkout-shockwave/goal-delta-report.html",
  "examples/goal-delta/checkout-shockwave/goal-delta.workprint.json",
  "examples/goal-delta/incident-isolation/goal-delta-report.html",
  "examples/goal-delta/incident-isolation/goal-delta.workprint.json",
  "examples/goal-delta/release-surface/goal-delta-report.html",
  "examples/goal-delta/release-surface/goal-delta.workprint.json",
  "examples/release-readiness/proofline-report.html",
  "hooks/hooks.json",
  "proofline.json",
  "schema/goal-contract.schema.json",
  "schema/goal-dependencies.schema.json",
  "schema/proofline.schema.json",
  "scripts/build-goal-delta-examples.mjs",
  "scripts/package-smoke.mjs",
  "scripts/macos-activation.mjs",
  "scripts/macos-contract.mjs",
  "scripts/macos-readiness.mjs",
  "scripts/macos-readiness.sh",
  "skills/proofline/SKILL.md"
];
const failures = [];

for (const relative of REQUIRED) {
  try {
    await access(path.join(ROOT, relative));
  } catch {
    failures.push(`missing required release file: ${relative}`);
  }
}

for (const relative of [
  "assets/screenshot-1.png",
  "docs/evidence/goal-delta-desktop.png",
  "docs/evidence/goal-delta-mobile.png",
  "docs/evidence/goal-delta-trace.png",
  "docs/evidence/proofline-overview.png",
  "docs/evidence/proofline-mobile.png",
  "examples/goal-delta/checkout-shockwave/goal-delta-report.html",
  "examples/goal-delta/incident-isolation/goal-delta-report.html",
  "examples/goal-delta/release-surface/goal-delta-report.html",
  "examples/release-readiness/proofline-report.html"
]) {
  try {
    const info = await stat(path.join(ROOT, relative));
    if (!info.isFile() || info.size < 1000) failures.push(`release artifact is unexpectedly small: ${relative}`);
  } catch {
    // The required-file check reports the missing artifact.
  }
}

const readme = await readFile(path.join(ROOT, "README.md"), "utf8").catch(() => "");
for (const phrase of [
  "Execution-after proof layer",
  "declared-only",
  "Windows",
  "macOS",
  "proofline run",
  "proofline report",
  "proofline goal-delta",
  "workprint-profile/0.1",
  "contract-revision-changed",
  "MIT"
]) {
  if (!readme.includes(phrase)) failures.push(`README is missing required release phrase: ${phrase}`);
}

const plugin = JSON.parse(await readFile(path.join(ROOT, ".codex-plugin", "plugin.json"), "utf8"));
for (const field of ["name", "version", "description", "license", "skills", "interface"]) {
  if (!plugin[field]) failures.push(`plugin manifest is missing ${field}`);
}

const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
for (const releaseFile of [
  "examples/",
  "RELEASE_NOTES.md",
  "SECURITY.md",
  "PROOFLINE_REPORT.md",
  "docs/MACOS_HANDOFF.md",
  "docs/evidence/macos-replacement-candidate.json",
  "scripts/macos-activation.mjs",
  "scripts/macos-contract.mjs",
  "scripts/macos-readiness.mjs",
  "scripts/macos-readiness.sh"
]) {
  if (!packageJson.files.includes(releaseFile)) {
    failures.push(`package files omit required release artifact: ${releaseFile}`);
  }
}

const candidatePath = path.join(ROOT, "docs", "evidence", "macos-replacement-candidate.json");
const descriptor = JSON.parse(await readFile(candidatePath, "utf8").catch(() => "{}"));
const computedCandidate = await computeCandidateIdentity(ROOT);
for (const field of ["id", "contentSha256", "contentFiles", "installedVersion", "scope"]) {
  if (descriptor[field] !== computedCandidate[field]) {
    failures.push(`macOS replacement candidate descriptor has stale ${field}`);
  }
}
if (descriptor.status !== "awaiting-full-real-mac-rerun" || descriptor.previousMacEvidenceImported !== false) {
  failures.push("macOS replacement candidate descriptor must remain a fresh, pending real-Mac candidate");
}

const expectedGoalDelta = {
  "checkout-shockwave": { changed: 1, added: 0, removed: 0, newlyStaleEvidence: 2 },
  "incident-isolation": { changed: 1, added: 0, removed: 0, newlyStaleEvidence: 1 },
  "release-surface": { changed: 0, added: 1, removed: 1, newlyStaleEvidence: 1 }
};
const observedVerdicts = new Set();
for (const [scenario, expected] of Object.entries(expectedGoalDelta)) {
  const profilePath = path.join(ROOT, "examples", "goal-delta", scenario, "goal-delta.workprint.json");
  const raw = await readFile(profilePath, "utf8").catch(() => "{}");
  const profile = JSON.parse(raw);
  if (profile.schemaVersion !== "workprint-profile/0.1" || profile.profile !== "goal-delta") {
    failures.push(`Goal Delta ${scenario} has an invalid Workprint profile shell`);
    continue;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (profile.summary?.counts?.[key] !== value) {
      failures.push(`Goal Delta ${scenario} has unexpected ${key}`);
    }
  }
  for (const finding of profile.findings ?? []) observedVerdicts.add(finding.verdict);
  if (/[A-Za-z]:[\\/]|\/(?:Users|home|private|tmp|var)\//u.test(raw)) {
    failures.push(`Goal Delta ${scenario} Workprint profile leaks an absolute path`);
  }
  if (/stdout|stderr|commandOutput/u.test(raw)) {
    failures.push(`Goal Delta ${scenario} Workprint profile contains command output fields`);
  }
}
for (const verdict of ["added", "removed", "changed", "unchanged"]) {
  if (!observedVerdicts.has(verdict)) failures.push(`Goal Delta examples do not cover ${verdict}`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Release file gate passed (${REQUIRED.length} artifacts).\n`);
}
