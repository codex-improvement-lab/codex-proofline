import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { appendRecord, environmentReceipt } from "./ledger.js";
import { proofRevision } from "./goal-binding.js";
import {
  fingerprintInputs,
  parseIsoDate,
  resolveInside,
  sha256File,
  toPosixPath
} from "./util.js";

function baseRecord(criterionId, proofId, kind, observedAt) {
  return {
    schemaVersion: 1,
    eventId: randomUUID(),
    criterionId,
    proofId,
    kind,
    observed: true,
    observedAt,
    recordedAt: new Date().toISOString()
  };
}

function findWindowsExecutable(command) {
  const hasPath = path.isAbsolute(command) || command.includes("\\") || command.includes("/");
  const directories = hasPath ? [""] : (process.env.PATH || "").split(path.delimiter);
  const extensions = path.extname(command)
    ? [""]
    : (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";");
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = hasPath ? `${command}${extension}` : path.join(directory, `${command}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return command;
}

function commandInvocation(command) {
  if (process.platform !== "win32") {
    return { executable: command[0], args: command.slice(1) };
  }
  const executable = findWindowsExecutable(command[0]);
  if (![".bat", ".cmd"].includes(path.extname(executable).toLowerCase())) {
    return { executable, args: command.slice(1) };
  }
  return {
    executable: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", "call", executable, ...command.slice(1)]
  };
}

export async function observeCommand(context, target, command, { environment, goalBinding } = {}) {
  const inputReceipt = target.proof.inputs
    ? await fingerprintInputs(context.root, target.proof.inputs)
    : null;
  const startedAt = Date.now();
  const stdoutHash = createHash("sha256");
  const stderrHash = createHash("sha256");
  let stdoutBytes = 0;
  let stderrBytes = 0;

  const invocation = commandInvocation(command);
  const result = await new Promise((resolve) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: context.root,
      env: process.env,
      shell: false,
      stdio: ["inherit", "pipe", "pipe"]
    });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.on("error", (error) => finish({
      exitCode: null,
      signal: null,
      errorCode: error.code || "SPAWN_ERROR"
    }));
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      stdoutHash.update(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      stderrHash.update(chunk);
      process.stderr.write(chunk);
    });
    child.on("close", (exitCode, signal) => finish({ exitCode, signal }));
  });

  const observedAt = new Date().toISOString();
  const record = {
    ...baseRecord(target.criterion.id, target.proof.id, "command", observedAt),
    proofRevision: proofRevision(target.criterion, target.proof),
    ...(goalBinding ? { goalBinding } : {}),
    command,
    result: {
      exitCode: result.exitCode,
      signal: result.signal,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      durationMs: Date.now() - startedAt,
      stdoutBytes,
      stderrBytes,
      stdoutSha256: stdoutHash.digest("hex"),
      stderrSha256: stderrHash.digest("hex")
    },
    environment: environmentReceipt(environment),
    source: "proofline-run"
  };
  if (inputReceipt) record.inputs = inputReceipt;
  return appendRecord(context.manifest.ledgerPath, record);
}

export async function observeArtifact(
  context,
  target,
  { environment, note, observedAt = new Date().toISOString(), goalBinding } = {}
) {
  const absolutePath = resolveInside(
    context.root,
    target.proof.path,
    `${target.criterion.id}/${target.proof.id} path`
  );
  const artifactStat = await stat(absolutePath);
  if (!artifactStat.isFile()) {
    throw new Error(`Artifact is not a file: ${target.proof.path}`);
  }
  const normalizedTime = parseIsoDate(observedAt, "observed-at");
  const record = {
    ...baseRecord(
      target.criterion.id,
      target.proof.id,
      target.proof.kind,
      normalizedTime
    ),
    proofRevision: proofRevision(target.criterion, target.proof),
    ...(goalBinding ? { goalBinding } : {}),
    artifact: {
      path: toPosixPath(target.proof.path),
      bytes: artifactStat.size,
      modifiedAt: artifactStat.mtime.toISOString(),
      sha256: await sha256File(absolutePath)
    },
    environment: environmentReceipt(environment),
    source: "proofline-capture"
  };
  if (note) record.note = note;
  return appendRecord(context.manifest.ledgerPath, record);
}

export async function declareClaim(context, target, note) {
  const declaredAt = new Date().toISOString();
  const record = {
    schemaVersion: 1,
    eventId: randomUUID(),
    criterionId: target.criterion.id,
    proofId: target.proof.id,
    kind: "claim",
    observed: false,
    declaredAt,
    recordedAt: declaredAt,
    expectedKind: target.proof.kind,
    note,
    source: "proofline-claim"
  };
  return appendRecord(context.manifest.ledgerPath, record);
}
