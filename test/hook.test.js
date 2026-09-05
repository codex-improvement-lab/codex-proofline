import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/proofline-stop.mjs");
const HOOK_CONFIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../hooks/hooks.json");

function invokeHook(input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HOOK], { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({
      exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.stdin.end(JSON.stringify(input));
  });
}

test("warn policy surfaces gaps without continuing the turn", async (t) => {
  const directory = await createTestDirectory("hook-warn");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest());

  const run = await invokeHook({ cwd: directory, hook_event_name: "Stop", stop_hook_active: false });
  assert.equal(run.exitCode, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.match(output.systemMessage, /0\/1 acceptance criteria/u);
  assert.equal(output.decision, undefined);
});

test("enforce-once policy continues exactly the first stop", async (t) => {
  const directory = await createTestDirectory("hook-enforce");
  t.after(() => removeTestDirectory(directory));
  await writeJson(path.join(directory, "proofline.json"), manifest({ completionPolicy: "enforce-once" }));

  const first = JSON.parse((await invokeHook({ cwd: directory, stop_hook_active: false })).stdout);
  assert.equal(first.decision, "block");
  const second = JSON.parse((await invokeHook({ cwd: directory, stop_hook_active: true })).stdout);
  assert.equal(second.decision, undefined);
  assert.match(second.systemMessage, /Gaps/u);
});

test("plugin hook quotes POSIX PLUGIN_ROOT and provides a Windows override", async () => {
  const config = JSON.parse(await readFile(HOOK_CONFIG, "utf8"));
  const hook = config.hooks.Stop[0].hooks[0];
  assert.equal(hook.command, "node \"${PLUGIN_ROOT}/scripts/proofline-stop.mjs\"");
  assert.equal(hook.commandWindows, "node \"%PLUGIN_ROOT%\\scripts\\proofline-stop.mjs\"");
});
