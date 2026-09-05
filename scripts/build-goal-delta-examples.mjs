import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest } from "../src/config.js";
import { evaluateProject } from "../src/evaluate.js";
import {
  createGoalDelta,
  createWorkprintProfile,
  loadGoalContract,
  loadGoalDependencies
} from "../src/goal-delta.js";
import { renderGoalDeltaHtml } from "../src/goal-delta-report.js";
import { receiptFor, sha256File, toPosixPath } from "../src/util.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES_ROOT = path.join(ROOT, "examples", "goal-delta");
const CLOCK = "2026-08-30T08:00:00.000Z";
const OBSERVED_AT = "2026-08-30T07:00:00.000Z";
const SCENARIOS = ["checkout-shockwave", "incident-isolation", "release-surface"];

async function writeEvidenceLedger(context, scenario) {
  const records = [];
  for (const criterion of context.manifest.criteria) {
    for (const proof of criterion.proof) {
      if (proof.kind === "command") {
        throw new Error(`Goal Delta example ${scenario} must use deterministic artifact receipts.`);
      }
      const absolutePath = path.join(context.root, ...proof.path.split("/"));
      const info = await stat(absolutePath);
      const record = {
        schemaVersion: 1,
        eventId: `${scenario}-${criterion.id}-${proof.id}`,
        criterionId: criterion.id,
        proofId: proof.id,
        kind: proof.kind,
        observed: true,
        observedAt: OBSERVED_AT,
        recordedAt: OBSERVED_AT,
        artifact: {
          path: toPosixPath(proof.path),
          bytes: info.size,
          modifiedAt: OBSERVED_AT,
          sha256: await sha256File(absolutePath)
        },
        environment: {
          label: proof.environment ?? "Windows 11 / deterministic local example",
          platform: "win32",
          release: "local-example",
          arch: "x64",
          node: "v24.19.0"
        },
        source: "proofline-goal-delta-example"
      };
      records.push({ ...record, receipt: receiptFor(record) });
    }
  }
  await writeFile(
    context.manifest.ledgerPath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
}

for (const scenario of SCENARIOS) {
  const directory = path.join(EXAMPLES_ROOT, scenario);
  const context = await loadManifest(path.join(directory, "proofline.json"));
  await writeEvidenceLedger(context, scenario);
  const before = await loadGoalContract(path.join(directory, "contracts", "before.json"), "Prior goal contract");
  const after = await loadGoalContract(path.join(directory, "contracts", "after.json"), "Target goal contract");
  const dependencies = await loadGoalDependencies(
    path.join(directory, "dependencies.json"),
    context,
    before,
    after
  );
  const evaluation = await evaluateProject(context, { now: new Date(CLOCK) });
  const delta = createGoalDelta({
    evaluation,
    before,
    after,
    dependencies,
    now: CLOCK
  });
  await writeFile(path.join(directory, "goal-delta-report.html"), `${renderGoalDeltaHtml(delta)}\n`, "utf8");
  await writeFile(
    path.join(directory, "goal-delta.workprint.json"),
    `${JSON.stringify(createWorkprintProfile(delta), null, 2)}\n`,
    "utf8"
  );
}

const overview = await readFile(path.join(EXAMPLES_ROOT, "README.md"), "utf8");
if (!overview.includes("checkout-shockwave") || !overview.includes("incident-isolation") || !overview.includes("release-surface")) {
  throw new Error("Goal Delta example README must name all deterministic scenarios.");
}
process.stdout.write(`Built ${SCENARIOS.length} deterministic Goal Delta scenarios.\n`);

