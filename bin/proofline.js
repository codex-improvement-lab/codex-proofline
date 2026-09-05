#!/usr/bin/env node

import { runCli } from "../src/cli.js";

runCli().catch((error) => {
  const prefix = error?.name === "ProoflineError" ? "Proofline" : "Unexpected error";
  process.stderr.write(`${prefix}: ${error.message}\n`);
  if (process.env.PROOFLINE_DEBUG === "1" && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exitCode = error?.exitCode ?? 1;
});

