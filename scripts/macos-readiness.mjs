#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIVATION_CONTRACT,
  HOOK_RECEIPTS,
  PLUGIN_DIRECTORIES,
  PLUGIN_FILES,
  SKILL_RECEIPT,
  assertPluginIdentity,
  computeCandidateIdentity,
  createActivationContract,
  inspectPluginIdentity,
  sha256,
  sha256File,
  stampStagedCandidate,
  validateFreshTaskEvidence
} from "./macos-contract.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

class GateError extends Error {
  constructor(check, message) {
    super(message);
    this.name = "GateError";
    this.check = check;
  }
}

function bytes(value) {
  return Buffer.byteLength(value, "utf8");
}

function parseArguments(argv) {
  const options = {
    implementationCheck: false,
    output: null,
    expectedContentSha256: null,
    printCandidate: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--implementation-check") {
      options.implementationCheck = true;
      continue;
    }
    if (value === "--print-candidate") {
      options.printCandidate = true;
      continue;
    }
    if (value === "--output") {
      options.output = argv[index + 1];
      index += 1;
      if (!options.output) throw new GateError("arguments", "--output requires a path.");
      continue;
    }
    if (value === "--expected-content-sha256") {
      options.expectedContentSha256 = argv[index + 1];
      index += 1;
      if (!/^[a-f0-9]{64}$/u.test(options.expectedContentSha256 || "")) {
        throw new GateError("arguments", "--expected-content-sha256 requires a lowercase SHA-256 digest.");
      }
      continue;
    }
    throw new GateError("arguments", `Unknown option: ${value}`);
  }
  return options;
}

export function resolveOutputPath(root, value) {
  const candidate = path.resolve(root, value);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (candidate !== path.resolve(root) && !candidate.startsWith(prefix)) {
    throw new GateError("output-path", "Evidence output must stay inside the repository.");
  }
  return candidate;
}

function summarize(result) {
  return {
    exitCode: result.exitCode,
    stdoutBytes: bytes(result.stdout),
    stderrBytes: bytes(result.stderr),
    stdoutSha256: sha256(result.stdout),
    stderrSha256: sha256(result.stderr)
  };
}

function run(executable, args, { cwd, env = process.env, input = "" } = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => finish({
      exitCode: null,
      errorCode: error.code || "SPAWN_ERROR",
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.on("close", (exitCode) => finish({
      exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.stdin.end(input);
  });
}

function requireExit(result, expected, check) {
  if (result.exitCode !== expected) {
    throw new GateError(check, `${check} exited ${result.exitCode ?? result.errorCode ?? "unknown"}; expected ${expected}.`);
  }
  return result;
}

async function recordCheck(evidence, id, task) {
  const startedAt = Date.now();
  try {
    const details = await task();
    evidence.checks.push({ id, ...details, status: "passed", durationMs: Date.now() - startedAt });
    process.stdout.write(`PASS ${id}\n`);
    return details;
  } catch (error) {
    evidence.checks.push({
      id,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorCode: error.check || "gate-error"
    });
    throw error;
  }
}

export function marketplaceDocument(name) {
  return {
    name,
    interface: { displayName: "Proofline macOS readiness" },
    plugins: [
      {
        name: "codex-proofline",
        source: { source: "local", path: "./plugins/codex-proofline" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity"
      }
    ]
  };
}

export async function buildLocalMarketplace(sourceRoot, marketplaceRoot, name) {
  const pluginRoot = path.join(marketplaceRoot, "plugins", "codex-proofline");
  await mkdir(pluginRoot, { recursive: true });
  for (const relative of PLUGIN_DIRECTORIES) {
    await cp(path.join(sourceRoot, relative), path.join(pluginRoot, relative), { recursive: true });
  }
  for (const relative of PLUGIN_FILES) {
    const destination = path.join(pluginRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(sourceRoot, relative), destination);
  }
  const marketplacePath = path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
  await mkdir(path.dirname(marketplacePath), { recursive: true });
  await writeFile(marketplacePath, `${JSON.stringify(marketplaceDocument(name), null, 2)}\n`, "utf8");
  return { pluginRoot, marketplacePath };
}

function assertNoSensitivePaths(serialized, forbidden) {
  for (const value of forbidden.filter(Boolean)) {
    const portable = value.replaceAll("\\", "/");
    const escaped = JSON.stringify(value).slice(1, -1);
    const escapedPortable = JSON.stringify(portable).slice(1, -1);
    if ([value, portable, escaped, escapedPortable].some((variant) => serialized.includes(variant))) {
      throw new GateError("evidence-redaction", "Evidence contains a local absolute path.");
    }
  }
}

export function serializeSanitizedEvidence(evidence, forbidden = []) {
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  assertNoSensitivePaths(serialized, forbidden);
  return serialized;
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function parseJsonLines(value, label) {
  const lines = value.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new GateError("fresh-task", `${label} was empty.`);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new GateError("fresh-task", `${label} line ${index + 1} was not valid JSON.`);
    }
  });
}

async function fixtureIntegrity(fixtureRoot) {
  const relatives = [
    "proofline.json",
    "fixtures with spaces/path probe.mjs",
    ".proofline/evidence.jsonl",
    "proofline-report.html"
  ];
  const values = {};
  for (const relative of relatives) values[relative] = await sha256File(path.join(fixtureRoot, relative));
  return values;
}

function sameIntegrity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function resolveCodexHome(environment) {
  return path.resolve(environment.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

async function removeWorkRoot(root, candidate) {
  const allowedRoot = path.resolve(root, ".proofline", "tmp");
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new GateError("cleanup-path", "Refusing to remove a gate path outside .proofline/tmp.");
  }
  await rm(resolved, { recursive: true, force: true });
}

async function createFixture(fixtureRoot, environmentLabel) {
  await mkdir(path.join(fixtureRoot, "fixtures with spaces"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "fixtures with spaces", "path probe.mjs"),
    "process.stdout.write('PROOFLINE_PATH_WITH_SPACES_OK\\n');\n",
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, "proofline.json"),
    `${JSON.stringify({
      version: 1,
      project: "Proofline macOS activation fixture",
      defaultFreshnessHours: 24,
      completionPolicy: "enforce-once",
      criteria: [
        {
          id: "AC-MAC-01",
          statement: "A command with a spaced path passes under an exact macOS environment contract.",
          proof: [
            {
              id: "path-command",
              kind: "command",
              label: "Spaced path command",
              environment: environmentLabel,
              inputs: ["fixtures with spaces/path probe.mjs"],
              freshnessHours: 24,
              expect: { exitCode: 0 }
            }
          ]
        },
        {
          id: "AC-MAC-02",
          statement: "The Stop hook exposes the deliberately missing proof line.",
          proof: [
            {
              id: "hook-sentinel",
              kind: "file",
              label: "Deliberately missing hook sentinel",
              path: "hook-sentinel.txt",
              freshnessHours: 24
            }
          ]
        }
      ]
    }, null, 2)}\n`,
    "utf8"
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  let candidate = await computeCandidateIdentity(ROOT);
  if (options.printCandidate) {
    process.stdout.write(`${JSON.stringify(candidate, null, 2)}\n`);
    return;
  }
  const mode = options.implementationCheck ? "implementation-check" : "real-mac";
  const outputPath = resolveOutputPath(
    ROOT,
    options.output || (options.implementationCheck
      ? ".proofline/tmp/macos-readiness-implementation.json"
      : "docs/evidence/macos-readiness.json")
  );
  const workRoot = path.join(ROOT, ".proofline", "tmp", `macos readiness path with spaces ${process.pid}-${Date.now()}`);
  const marketplaceRoot = path.join(workRoot, "local marketplace with spaces");
  const fixtureRoot = path.join(workRoot, "fresh task workspace with spaces");
  const marketplaceName = "proofline-macos-readiness";
  const pluginSelector = `codex-proofline@${marketplaceName}`;
  const environmentLabel = mode === "real-mac"
    ? "macOS / local host / automated readiness gate"
    : `${process.platform} / implementation check / not macOS evidence`;
  const evidence = {
    schemaVersion: 2,
    product: "codex-proofline",
    gateVersion: 2,
    evidenceClass: mode === "real-mac"
      ? "real-mac-local-host"
      : "non-macos-implementation-check",
    observedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      node: process.version
    },
    pathWithSpacesExercised: workRoot.includes(" "),
    rawOutputStored: false,
    candidate: { ...candidate },
    checks: [],
    cleanup: { pluginRemoved: false, marketplaceRemoved: false, installedCacheAbsent: false },
    overall: "failed"
  };
  let codexEnvironment = process.env;
  let marketplaceAdded = false;
  let pluginInstalled = false;
  let installedCacheBase = null;
  let installedCacheRoot = null;
  let installedIdentity = null;
  let failure = null;

  try {
    if (mode === "real-mac" && process.platform !== "darwin") {
      throw new GateError("real-mac-host", "The real gate must run on Darwin; use --implementation-check elsewhere.");
    }
    await mkdir(workRoot, { recursive: true });
    if (mode === "implementation-check") {
      const isolatedHome = path.join(workRoot, "isolated codex home with spaces");
      await mkdir(isolatedHome, { recursive: true });
      codexEnvironment = { ...process.env, CODEX_HOME: isolatedHome };
    }
    installedCacheBase = path.join(
      resolveCodexHome(codexEnvironment),
      "plugins",
      "cache",
      marketplaceName,
      "codex-proofline"
    );

    await recordCheck(evidence, "candidate-source-identity", async () => {
      if (mode === "real-mac" && !options.expectedContentSha256) {
        throw new GateError("candidate-pin", "The real-Mac gate requires --expected-content-sha256 for the transferred candidate.");
      }
      if (options.expectedContentSha256 && options.expectedContentSha256 !== candidate.contentSha256) {
        throw new GateError("candidate-pin", "The checkout bytes do not match the expected replacement candidate.");
      }
      return {
        candidateId: candidate.id,
        contentSha256: candidate.contentSha256,
        contentFiles: candidate.contentFiles,
        expectedContentSha256Matched: options.expectedContentSha256 ? true : null
      };
    });

    await recordCheck(evidence, "node-20-and-codex-cli", async () => {
      const nodeResult = requireExit(await run(process.execPath, ["--version"], { cwd: ROOT }), 0, "node-version");
      const major = Number.parseInt(process.versions.node.split(".")[0], 10);
      if (major < 20) throw new GateError("node-version", "Node.js 20 or newer is required.");
      const codexResult = requireExit(await run("codex", ["plugin", "--help"], { cwd: ROOT, env: codexEnvironment }), 0, "codex-plugin-cli");
      const versionResult = requireExit(await run("codex", ["--version"], { cwd: ROOT, env: codexEnvironment }), 0, "codex-version");
      evidence.host.codex = versionResult.stdout.trim().replace(/^codex-cli\s+/u, "");
      return { node: summarize(nodeResult), codex: summarize(codexResult) };
    });

    await recordCheck(evidence, "node-test-suite", async () => {
      const result = requireExit(await run(process.execPath, ["--test", "--test-reporter=spec"], {
        cwd: ROOT,
        env: process.env
      }), 0, "node-test-suite");
      return { command: summarize(result) };
    });

    if (mode === "real-mac") {
      await recordCheck(evidence, "darwin-hardware-model", async () => {
        const result = requireExit(await run("/usr/sbin/sysctl", ["-n", "hw.model"], { cwd: ROOT }), 0, "darwin-hardware-model");
        const model = result.stdout.trim();
        if (!model) throw new GateError("darwin-hardware-model", "hw.model was empty.");
        evidence.host.hardwareModel = model;
        return { command: summarize(result) };
      });
    }

    let built;
    await recordCheck(evidence, "local-marketplace-with-spaces", async () => {
      built = await buildLocalMarketplace(ROOT, marketplaceRoot, marketplaceName);
      candidate = await stampStagedCandidate(built.pluginRoot, candidate);
      evidence.candidate = { ...candidate };
      await access(path.join(built.pluginRoot, ".codex-plugin", "plugin.json"));
      await access(path.join(built.pluginRoot, "hooks", "hooks.json"));
      await access(path.join(built.pluginRoot, "skills", "proofline", "SKILL.md"));
      const catalog = JSON.parse(await readFile(built.marketplacePath, "utf8"));
      if (catalog.plugins[0].source.path !== "./plugins/codex-proofline") {
        throw new GateError("local-marketplace", "Marketplace source path is not portable.");
      }
      return {
        portableSource: "./plugins/codex-proofline",
        requiredComponents: 3,
        installedVersion: candidate.installedVersion,
        installedContentSha256: candidate.installedContentSha256
      };
    });
    await createFixture(fixtureRoot, environmentLabel);
    const pluginBin = path.join(built.pluginRoot, "bin", "proofline.js");
    const probePath = path.join(fixtureRoot, "fixtures with spaces", "path probe.mjs");

    await recordCheck(evidence, "exact-environment-contract", async () => {
      const result = await run(process.execPath, [
        pluginBin,
        "run",
        "AC-MAC-01/path-command",
        "--environment",
        "wrong environment",
        "--",
        process.execPath,
        probePath
      ], { cwd: fixtureRoot });
      requireExit(result, 2, "exact-environment-contract");
      if (!/exactly match/u.test(result.stderr)) {
        throw new GateError("exact-environment-contract", "Mismatch did not fail with the expected contract message.");
      }
      return { command: summarize(result) };
    });

    await recordCheck(evidence, "core-workflow-with-spaced-path", async () => {
      const runResult = requireExit(await run(process.execPath, [
        pluginBin,
        "run",
        "AC-MAC-01/path-command",
        "--environment",
        environmentLabel,
        "--",
        process.execPath,
        probePath
      ], { cwd: fixtureRoot }), 0, "core-run");
      if (!runResult.stdout.includes("PROOFLINE_PATH_WITH_SPACES_OK")) {
        throw new GateError("core-run", "Spaced path probe token was absent.");
      }
      const statusResult = requireExit(await run(process.execPath, [pluginBin, "status", "--json"], { cwd: fixtureRoot }), 0, "core-status");
      const status = JSON.parse(statusResult.stdout);
      if (status.criteria[0].status !== "verified" || status.criteria[1].status !== "missing") {
        throw new GateError("core-status", "Fixture did not preserve verified and missing states.");
      }
      const reportResult = requireExit(await run(process.execPath, [
        pluginBin,
        "report",
        "--format",
        "html",
        "--output",
        "proofline-report.html"
      ], { cwd: fixtureRoot }), 0, "core-report");
      const report = await readFile(path.join(fixtureRoot, "proofline-report.html"), "utf8");
      if (!report.includes("Proof, <em>not promises.</em>") || /<script[^>]+src=/u.test(report)) {
        throw new GateError("core-report", "HTML report is not the expected self-contained report.");
      }
      return {
        run: summarize(runResult),
        statusCommand: summarize(statusResult),
        report: summarize(reportResult)
      };
    });

    await recordCheck(evidence, "plugin-root-stop-hook", async () => {
      const hookInput = JSON.stringify({
        session_id: "redacted",
        turn_id: "redacted",
        cwd: fixtureRoot,
        hook_event_name: "Stop",
        stop_hook_active: false,
        last_assistant_message: "Activation probe"
      });
      let result;
      if (process.platform === "darwin") {
        const hookConfig = JSON.parse(await readFile(path.join(built.pluginRoot, "hooks", "hooks.json"), "utf8"));
        const command = hookConfig.hooks.Stop[0].hooks[0].command;
        result = await run("/bin/sh", ["-c", command], {
          cwd: fixtureRoot,
          env: { ...process.env, PLUGIN_ROOT: built.pluginRoot },
          input: hookInput
        });
      } else {
        result = await run(process.execPath, [path.join(built.pluginRoot, "scripts", "proofline-stop.mjs")], {
          cwd: fixtureRoot,
          env: { ...process.env, PLUGIN_ROOT: built.pluginRoot },
          input: hookInput
        });
      }
      requireExit(result, 0, "plugin-root-stop-hook");
      const output = JSON.parse(result.stdout);
      if (output.decision !== "block" || !/Proofline:/u.test(output.reason || "")) {
        throw new GateError("plugin-root-stop-hook", "Stop hook did not expose the deliberate gap.");
      }
      return { command: summarize(result), posixShellObserved: process.platform === "darwin" };
    });

    await recordCheck(evidence, "marketplace-add-and-discovery", async () => {
      const addResult = requireExit(await run("codex", ["plugin", "marketplace", "add", marketplaceRoot, "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      }), 0, "marketplace-add");
      marketplaceAdded = true;
      const listResult = requireExit(await run("codex", ["plugin", "list", "--marketplace", marketplaceName, "--available", "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      }), 0, "marketplace-discovery");
      if (!listResult.stdout.includes("codex-proofline")) {
        throw new GateError("marketplace-discovery", "Codex did not discover codex-proofline.");
      }
      return { add: summarize(addResult), list: summarize(listResult) };
    });

    await recordCheck(evidence, "plugin-install-and-status", async () => {
      const installResult = requireExit(await run("codex", ["plugin", "add", pluginSelector, "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      }), 0, "plugin-install");
      pluginInstalled = true;
      let install;
      try {
        install = JSON.parse(installResult.stdout);
      } catch {
        throw new GateError("plugin-install", "Codex plugin install did not return valid JSON.");
      }
      if (install.pluginId !== pluginSelector ||
          install.name !== "codex-proofline" ||
          install.marketplaceName !== marketplaceName ||
          install.version !== candidate.installedVersion ||
          !path.isAbsolute(install.installedPath || "")) {
        throw new GateError("plugin-install", "Codex plugin install identity did not match the replacement candidate.");
      }
      installedCacheRoot = path.resolve(install.installedPath);
      const cacheRelative = path.relative(path.resolve(installedCacheBase), installedCacheRoot);
      if (!cacheRelative ||
          cacheRelative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(cacheRelative) ||
          cacheRelative.includes(path.sep)) {
        throw new GateError("plugin-install", "Codex reported an installed path outside the dedicated plugin cache.");
      }
      const listResult = requireExit(await run("codex", ["plugin", "list", "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      }), 0, "plugin-status");
      if (!listResult.stdout.includes("codex-proofline")) {
        throw new GateError("plugin-status", "Installed plugin was absent from status output.");
      }
      return { install: summarize(installResult), list: summarize(listResult) };
    });

    await recordCheck(evidence, "installed-cache-identity", async () => {
      try {
        installedIdentity = await inspectPluginIdentity(installedCacheRoot);
        assertPluginIdentity(installedIdentity, candidate);
      } catch (error) {
        throw new GateError("installed-cache-identity", error.message);
      }
      const cachedBin = path.join(installedCacheRoot, "bin", "proofline.js");
      const versionResult = requireExit(await run(process.execPath, [cachedBin, "version"], {
        cwd: fixtureRoot
      }), 0, "installed-cache-version");
      if (versionResult.stdout.trim() !== candidate.installedVersion) {
        throw new GateError("installed-cache-version", "Cached CLI version did not match the staged candidate.");
      }
      const statusResult = requireExit(await run(process.execPath, [cachedBin, "status", "--json"], {
        cwd: fixtureRoot
      }), 0, "installed-cache-status");
      const status = JSON.parse(statusResult.stdout);
      if (status.criteria[0].status !== "verified" || status.criteria[1].status !== "missing") {
        throw new GateError("installed-cache-status", "Cached CLI did not evaluate the expected fixture states.");
      }
      return {
        cacheLayout: "$CODEX_HOME/plugins/cache/<marketplace>/<plugin>/<reported-slot>",
        cacheSlot: path.basename(installedCacheRoot),
        identityReadDirectly: true,
        installedVersion: installedIdentity.packageVersion,
        installedContentSha256: installedIdentity.installedContentSha256,
        skillSha256: installedIdentity.skillSha256,
        hookConfigSha256: installedIdentity.hookConfigSha256,
        versionCommand: summarize(versionResult),
        statusCommand: summarize(statusResult)
      };
    });

    if (mode === "real-mac") {
      await recordCheck(evidence, "fresh-task-skill-and-hook", async () => {
        const lastMessagePath = path.join(workRoot, "fresh task final.txt");
        const contract = createActivationContract(
          candidate,
          installedIdentity,
          randomBytes(16).toString("hex"),
          randomBytes(16).toString("hex")
        );
        const contractPath = path.join(fixtureRoot, ACTIVATION_CONTRACT);
        await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        const integrityBefore = await fixtureIntegrity(fixtureRoot);
        const prompt = "$proofline Run the installed Proofline activation self-check exactly. This is a disposable gate workspace; do not change its manifest, source fixture, evidence ledger, or report.";
        const result = requireExit(await run("codex", [
          "exec",
          "--ephemeral",
          "--dangerously-bypass-hook-trust",
          "--sandbox",
          "workspace-write",
          "--skip-git-repo-check",
          "-C",
          fixtureRoot,
          "--json",
          "--output-last-message",
          lastMessagePath,
          prompt
        ], { cwd: fixtureRoot, env: codexEnvironment }), 0, "fresh-task");
        const finalMessage = await readFile(lastMessagePath, "utf8");
        let activationRaw;
        let hookRaw;
        try {
          activationRaw = await readFile(path.join(fixtureRoot, SKILL_RECEIPT), "utf8");
          hookRaw = await readFile(path.join(fixtureRoot, HOOK_RECEIPTS), "utf8");
        } catch {
          throw new GateError("fresh-task", "Fresh task did not create both direct activation receipts.");
        }
        const activationReceipt = JSON.parse(activationRaw);
        const hookReceipts = parseJsonLines(hookRaw, "Stop hook receipt");
        let direct;
        try {
          direct = validateFreshTaskEvidence({ finalMessage, activationReceipt, hookReceipts, contract });
        } catch (error) {
          throw new GateError("fresh-task", error.message);
        }
        const integrityAfter = await fixtureIntegrity(fixtureRoot);
        if (!sameIntegrity(integrityBefore, integrityAfter)) {
          throw new GateError("fresh-task", "Fresh task changed protected fixture, evidence, or report bytes.");
        }
        return {
          codexExec: summarize(result),
          finalMessageSha256: sha256(finalMessage),
          skillReceiptSha256: sha256(activationRaw),
          hookReceiptsSha256: sha256(hookRaw),
          skillActivated: direct.skillActivated,
          stopHookActivated: direct.stopHookActivated,
          hookInvocations: direct.hookInvocations,
          modelVersionEchoRequired: false,
          protectedWorkspaceBytesUnchanged: true,
          hookTrustMode: "vetted-one-shot-bypass"
        };
      });
    } else {
      evidence.checks.push({
        id: "fresh-task-skill-and-hook",
        status: "not-run",
        reason: "Requires an authenticated fresh Codex session on a real Mac."
      });
    }

    evidence.overall = mode === "real-mac" ? "passed" : "implementation-check-passed";
  } catch (error) {
    failure = error;
    process.stderr.write(`FAIL ${error.check || "gate"}: ${error.message}\n`);
  } finally {
    if (pluginInstalled) {
      const result = await run("codex", ["plugin", "remove", pluginSelector, "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      });
      const statusResult = await run("codex", ["plugin", "list", "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      });
      evidence.cleanup.pluginRemoved = result.exitCode === 0 &&
        statusResult.exitCode === 0 &&
        !statusResult.stdout.includes(marketplaceName);
      evidence.cleanup.pluginRemoveReceipt = summarize(result);
      evidence.cleanup.pluginStatusAfterRemoveReceipt = summarize(statusResult);
    } else {
      evidence.cleanup.pluginRemoved = true;
    }
    evidence.cleanup.installedCacheAbsent = installedCacheRoot
      ? !(await pathExists(installedCacheRoot))
      : !pluginInstalled;
    if (marketplaceAdded) {
      const result = await run("codex", ["plugin", "marketplace", "remove", marketplaceName, "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      });
      const listResult = await run("codex", ["plugin", "marketplace", "list", "--json"], {
        cwd: ROOT,
        env: codexEnvironment
      });
      evidence.cleanup.marketplaceRemoved = result.exitCode === 0 &&
        listResult.exitCode === 0 &&
        !listResult.stdout.includes(marketplaceName);
      evidence.cleanup.marketplaceRemoveReceipt = summarize(result);
      evidence.cleanup.marketplaceStatusAfterRemoveReceipt = summarize(listResult);
    } else {
      evidence.cleanup.marketplaceRemoved = true;
    }
    if (!evidence.cleanup.pluginRemoved ||
        !evidence.cleanup.marketplaceRemoved ||
        !evidence.cleanup.installedCacheAbsent) {
      evidence.overall = "failed";
      failure ||= new GateError("cleanup", "Plugin, marketplace, or installed-cache cleanup failed.");
    }
    evidence.completedAt = new Date().toISOString();
    const serialized = serializeSanitizedEvidence(evidence, [ROOT, workRoot, os.homedir()]);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, "utf8");
    await removeWorkRoot(ROOT, workRoot);
    process.stdout.write(`Evidence: ${path.relative(ROOT, outputPath).split(path.sep).join("/")}\n`);
  }

  if (failure) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || "") === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`Unexpected macOS readiness error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
