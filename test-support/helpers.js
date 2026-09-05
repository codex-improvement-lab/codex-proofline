import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_ROOT = path.join(PROJECT_ROOT, ".proofline", "tmp", "tests");

export async function createTestDirectory(name) {
  const directory = path.join(TEST_ROOT, `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function removeTestDirectory(directory) {
  const resolved = path.resolve(directory);
  const allowed = `${path.resolve(TEST_ROOT)}${path.sep}`;
  if (!resolved.startsWith(allowed)) throw new Error(`Refusing to remove test path outside ${TEST_ROOT}`);
  await rm(resolved, { recursive: true, force: true });
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function manifest(overrides = {}) {
  return {
    version: 1,
    project: "Test project",
    defaultFreshnessHours: 72,
    completionPolicy: "warn",
    criteria: [
      {
        id: "AC-01",
        statement: "The workflow is supported by evidence.",
        proof: [
          {
            id: "tests",
            kind: "command",
            label: "Tests",
            freshnessHours: 24,
            expect: { exitCode: 0 }
          }
        ]
      }
    ],
    ...overrides
  };
}

