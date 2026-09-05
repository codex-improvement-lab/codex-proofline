import { appendFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProoflineError } from "./errors.js";
import { evidenceRef, receiptFor } from "./util.js";

export async function readLedger(ledgerPath) {
  let raw;
  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const records = [];
  for (const [index, line] of raw.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new ProoflineError(
        `Ledger line ${index + 1} is not valid JSON: ${error.message}`,
        { code: "INVALID_LEDGER" }
      );
    }
  }
  return records;
}

export async function appendRecord(ledgerPath, record) {
  const normalized = JSON.parse(JSON.stringify(record));
  const complete = { ...normalized, receipt: receiptFor(normalized) };
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await appendFile(ledgerPath, `${JSON.stringify(complete)}\n`, "utf8");
  return complete;
}

export function environmentReceipt(label) {
  return {
    label: label || `${os.platform()} ${os.release()}`,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    node: process.version
  };
}

export function latestRecords(records) {
  const latest = new Map();
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const key = evidenceRef(record.criterionId, record.proofId);
    const current = latest.get(key);
    const recordTime = Date.parse(record.observedAt ?? record.declaredAt ?? 0);
    const currentTime = Date.parse(current?.observedAt ?? current?.declaredAt ?? 0);
    if (!current || recordTime >= currentTime) latest.set(key, record);
  }
  return latest;
}
