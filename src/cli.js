import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest } from "./config.js";
import { ProoflineError } from "./errors.js";
import { evaluateProject } from "./evaluate.js";
import {
  createGoalDelta,
  createWorkprintProfile,
  loadGoalContract,
  loadGoalDependencies
} from "./goal-delta.js";
import { renderGoalDeltaHtml } from "./goal-delta-report.js";
import { queryGoalDelta } from "./query.js";
import { declareClaim, observeArtifact, observeCommand } from "./observe.js";
import { renderHtmlReport, renderMarkdownReport } from "./report.js";
import { serveReport } from "./server.js";
import { parseIsoDate, splitEvidenceRef } from "./util.js";

const HELP = `
Codex Proofline — proof, not promises

Usage:
  proofline init [directory]
  proofline run <criterion/proof> [--environment <label>] -- <command> [...args]
  proofline capture <criterion/proof> [--environment <label>] [--note <text>]
  proofline claim <criterion/proof> --note <text>
  proofline status [--json]
  proofline check [--json]
  proofline report [--format markdown|html|json] [--output <path|->]
  proofline goal-delta --from <contract.json> --to <contract.json> --dependencies <dependencies.json> [--output <report.html>] [--profile-output <workprint.json>] [--at <ISO-8601>]
  proofline goal-delta --from <contract.json> --to <contract.json> --dependencies <dependencies.json> --json [--gaps] [--affected] [--status <state>] [--item <id>] [--evidence <criterion/proof>]
  proofline serve [--host 127.0.0.1] [--port 4317]

Common option (all commands except init):
  --manifest <path>   Manifest path (default: ./proofline.json)

States:
  verified · missing · stale · declared-only · failed
`.trim();

const VALUE_OPTIONS = new Set([
  "manifest",
  "environment",
  "note",
  "observed-at",
  "format",
  "output",
  "host",
  "port",
  "from",
  "to",
  "dependencies",
  "profile-output",
  "at", "status", "item", "evidence"
]);
const BOOLEAN_OPTIONS = new Set(["json", "help", "gaps", "affected"]);

const COMMAND_OPTIONS = {
  init: [],
  run: ["manifest", "environment"],
  capture: ["manifest", "environment", "note", "observed-at"],
  claim: ["manifest", "note"],
  status: ["manifest", "json", "at"],
  check: ["manifest", "json", "at"],
  report: ["manifest", "format", "output", "at"],
  "goal-delta": ["manifest", "from", "to", "dependencies", "output", "profile-output", "at", "json", "status", "item", "evidence", "gaps", "affected"],
  serve: ["manifest", "host", "port"]
};
function validateOptions(command, options) {
  if (!COMMAND_OPTIONS[command]) throw new ProoflineError(`Unknown command: ${command}. Run proofline help.`);
  for (const name of Object.keys(options)) {
    if (name !== "help" && !COMMAND_OPTIONS[command].includes(name)) {
      throw new ProoflineError(`${command} does not support --${name}.`);
    }
  }
}

function parseArguments(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if (Object.hasOwn(options, name)) throw new ProoflineError(`Duplicate option: ${token}.`);
    if (BOOLEAN_OPTIONS.has(name)) {
      options[name] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) {
      throw new ProoflineError(`Unknown option: ${token}.`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new ProoflineError(`${token} requires a value.`);
    }
    options[name] = value;
    index += 1;
  }
  return { options, positionals };
}

function targetFor(context, value) {
  const { criterionId, proofId } = splitEvidenceRef(value);
  const target = context.proofs.get(`${criterionId}/${proofId}`);
  if (!target) {
    throw new ProoflineError(`Unknown proof line: ${criterionId}/${proofId}.`);
  }
  return target;
}

function statusLine(status) {
  return {
    verified: "✓ verified",
    missing: "○ missing",
    stale: "◷ stale",
    "declared-only": "! declared only",
    failed: "× failed"
  }[status];
}

function printStatus(result) {
  process.stdout.write(
    `\nPROOFLINE  ${result.project}\n${result.summary.verifiedCriteria}/${result.summary.totalCriteria} criteria · ${result.summary.verifiedProofs}/${result.summary.totalProofs} proof lines verified\n\n`
  );
  for (const criterion of result.criteria) {
    process.stdout.write(`${statusLine(criterion.status).padEnd(17)} ${criterion.id}  ${criterion.statement}\n`);
    for (const proof of criterion.proofs) {
      process.stdout.write(`  ${statusLine(proof.status).padEnd(17)} ${proof.ref}  ${proof.label}\n`);
    }
  }
  process.stdout.write(`\n${result.ready ? "READY" : "EVIDENCE GAPS"}\n`);
}

async function initialize(directory) {
  const root = path.resolve(directory || ".");
  const manifestPath = path.join(root, "proofline.json");
  await mkdir(root, { recursive: true });
  const project = path.basename(root);
  const sample = {
    version: 1,
    project,
    defaultFreshnessHours: 72,
    completionPolicy: "warn",
    criteria: [
      {
        id: "AC-01",
        statement: "The primary workflow passes its automated checks.",
        proof: [
          {
            id: "tests",
            kind: "command",
            label: "Automated test suite",
            freshnessHours: 24,
            expect: { exitCode: 0 }
          }
        ]
      },
      {
        id: "AC-02",
        statement: "The user-visible result has current visual evidence.",
        proof: [
          {
            id: "overview",
            kind: "screenshot",
            label: "Primary workflow screenshot",
            path: "docs/evidence/overview.png",
            environment: `${os.type()} ${os.release()} / browser-or-device`,
            freshnessHours: 168
          }
        ]
      }
    ]
  };
  try {
    await writeFile(manifestPath, `${JSON.stringify(sample, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new ProoflineError(`Refusing to overwrite existing manifest: ${manifestPath}.`);
    }
    throw error;
  }
  process.stdout.write(`Created ${manifestPath}\n`);
}

function parsePort(value) {
  const port = Number(value ?? 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ProoflineError("port must be an integer from 1 to 65535.");
  }
  return port;
}

async function writeReport(result, format, output) {
  let body;
  let defaultName;
  if (format === "html") {
    body = `${renderHtmlReport(result)}\n`;
    defaultName = "proofline-report.html";
  } else if (format === "json") {
    body = `${JSON.stringify(result, null, 2)}\n`;
    defaultName = "proofline-report.json";
  } else if (format === "markdown" || format === "md") {
    body = renderMarkdownReport(result);
    defaultName = "proofline-report.md";
  } else {
    throw new ProoflineError("format must be markdown, html, or json.");
  }
  if (output === "-") {
    process.stdout.write(body);
    return;
  }
  const targetPath = path.resolve(output || defaultName);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, body, "utf8");
  process.stdout.write(`Wrote ${targetPath}\n`);
}

async function writeGoalDelta(context, options) {
  if (options.json && (options.output || options["profile-output"])) {
    throw new ProoflineError("goal-delta --json is a read-only stdout query; omit --output and --profile-output.");
  }
  if (!options.json && ["status", "item", "evidence", "gaps", "affected"].some(name => options[name])) {
    throw new ProoflineError("goal-delta filters require --json.");
  }
  for (const name of ["from", "to", "dependencies"]) {
    if (!options[name]) throw new ProoflineError(`goal-delta requires --${name} <path>.`);
  }
  if (options.output === "-" && options["profile-output"] === "-") {
    throw new ProoflineError("goal-delta cannot write both HTML and Workprint JSON to stdout.");
  }
  const before = await loadGoalContract(options.from, "Prior goal contract");
  const after = await loadGoalContract(options.to, "Target goal contract");
  const dependencies = await loadGoalDependencies(options.dependencies, context, before, after);
  const now = new Date(options.at ? parseIsoDate(options.at, "at") : new Date().toISOString());
  const evaluation = await evaluateProject(context, { now });
  const delta = createGoalDelta({ evaluation, before, after, dependencies, now });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(queryGoalDelta(delta, options), null, 2)}\n`);
    return;
  }
  const html = `${renderGoalDeltaHtml(delta)}\n`;
  const profile = `${JSON.stringify(createWorkprintProfile(delta), null, 2)}\n`;
  const output = options.output ?? "goal-delta-report.html";
  const profileOutput = options["profile-output"] ?? "goal-delta.workprint.json";

  for (const [target, body, label] of [
    [output, html, "Goal Delta report"],
    [profileOutput, profile, "Workprint profile"]
  ]) {
    if (target === "-") {
      process.stdout.write(body);
      continue;
    }
    const targetPath = path.resolve(target);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, body, "utf8");
    const diagnostics = output === "-" || profileOutput === "-" ? process.stderr : process.stdout;
    diagnostics.write(`Wrote ${label}: ${targetPath}\n`);
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command = "help", ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (command === "--version" || command === "version") {
    const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");
    const packageJson = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(packagePath, "utf8")));
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }
  if (command === "init") {
    const { positionals, options } = parseArguments(rest);
    if (options.help) return process.stdout.write(`${HELP}\n`);
    validateOptions(command, options);
    if (positionals.length > 1) throw new ProoflineError("init accepts at most one directory.");
    await initialize(positionals[0]);
    return;
  }

  if (command === "run") {
    const divider = rest.indexOf("--");
    if (divider < 0 || divider === rest.length - 1) {
      throw new ProoflineError("run requires -- followed by a command.");
    }
    const { positionals, options } = parseArguments(rest.slice(0, divider));
    validateOptions(command, options);
    if (positionals.length !== 1) {
      throw new ProoflineError("run requires one <criterion/proof> reference.");
    }
    const context = await loadManifest(options.manifest);
    const target = targetFor(context, positionals[0]);
    if (target.proof.kind !== "command") {
      throw new ProoflineError(`${positionals[0]} expects ${target.proof.kind} evidence; use capture.`);
    }
    if (target.proof.environment) {
      if (!options.environment) {
        throw new ProoflineError(
          `Command proof requires --environment "${target.proof.environment}".`
        );
      }
      if (options.environment !== target.proof.environment) {
        throw new ProoflineError(
          `Environment label must exactly match the manifest: ${target.proof.environment}.`
        );
      }
    }
    const record = await observeCommand(context, target, rest.slice(divider + 1), {
      environment: options.environment
    });
    process.stdout.write(`\nRecorded ${positionals[0]} · ${record.receipt}\n`);
    const expected = target.proof.expect?.exitCode ?? 0;
    if (record.result.exitCode !== expected) process.exitCode = 1;
    return;
  }

  const { positionals, options } = parseArguments(rest);
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  validateOptions(command, options);
  const context = await loadManifest(options.manifest);
  const clock = options.at ? { now: new Date(parseIsoDate(options.at, "at")) } : {};

  if (command === "goal-delta") {
    if (positionals.length !== 0) {
      throw new ProoflineError("goal-delta does not accept positional arguments.");
    }
    await writeGoalDelta(context, options);
    return;
  }

  if (command === "capture") {
    if (positionals.length !== 1) throw new ProoflineError("capture requires one <criterion/proof> reference.");
    const target = targetFor(context, positionals[0]);
    if (target.proof.kind === "command") {
      throw new ProoflineError(`${positionals[0]} expects command evidence; use run.`);
    }
    if (target.proof.environment) {
      if (!options.environment) {
        const kind = target.proof.kind === "screenshot" ? "Screenshot" : "Artifact";
        throw new ProoflineError(`${kind} capture requires an explicit --environment label.`);
      }
      if (options.environment !== target.proof.environment) {
        throw new ProoflineError(
          `Environment label must exactly match the manifest: ${target.proof.environment}.`
        );
      }
    }
    const record = await observeArtifact(context, target, {
      environment: options.environment,
      note: options.note,
      observedAt: options["observed-at"]
    });
    process.stdout.write(`Recorded ${positionals[0]} · ${record.receipt}\n`);
    return;
  }

  if (command === "claim") {
    if (positionals.length !== 1) throw new ProoflineError("claim requires one <criterion/proof> reference.");
    if (!options.note) throw new ProoflineError("claim requires --note explaining what remains unobserved.");
    const target = targetFor(context, positionals[0]);
    const record = await declareClaim(context, target, options.note);
    process.stdout.write(`Recorded declaration for ${positionals[0]} · ${record.receipt}\n`);
    return;
  }

  if (command === "status" || command === "check") {
    if (positionals.length !== 0) throw new ProoflineError(`${command} does not accept positional arguments.`);
    const result = await evaluateProject(context, clock);
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else printStatus(result);
    if (command === "check" && !result.ready) process.exitCode = 1;
    return;
  }

  if (command === "report") {
    if (positionals.length !== 0) throw new ProoflineError("report does not accept positional arguments.");
    await writeReport(await evaluateProject(context, clock), options.format ?? "markdown", options.output);
    return;
  }

  if (command === "serve") {
    if (positionals.length !== 0) throw new ProoflineError("serve does not accept positional arguments.");
    const host = options.host ?? "127.0.0.1";
    const port = parsePort(options.port);
    await serveReport(context, { host, port });
    process.stdout.write(`Proofline is listening at http://${host}:${port}\nPress Ctrl+C to stop.\n`);
    return new Promise(() => {});
  }

  throw new ProoflineError(`Unknown command: ${command}. Run proofline help.`);
}
