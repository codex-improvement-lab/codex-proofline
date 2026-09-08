# Internal maintenance replay protocol — frozen before measurement

Date: 2026-09-08. This is a non-blind, controlled replay of actual Lab maintenance material. It is not an external-user experiment, a recorded historical action sequence, or a benchmark of agent reasoning quality.

Materials: Intake `src/core/intake.js` at the observed pre-fix commit `88cc6abf548b1b5a3fb8dfd6213c76df923aa3da` and the M1 fix `fe4002b`; the multi-signal/30-requirement/final-condition counterexamples from the mainline mission and committed regression tests. The assisted tools use the local M3 candidate commits (Intake `9fea7d4`, Proofline `ad45755`, Workprint `b6f96d4`). Store exact source bytes, SHA-256 values, commands and result records with each measurement run.

Three task classes share fixed source/check material and the same independent result oracle:

1. **Defect-fix acceptance replay:** reproduce the known missing acceptance candidates against the pre-fix compiler; apply the same known source replacement; verify coverage and redaction. This measures the acceptance/reproduction procedure, not time to discover or implement the fix.
2. **Acceptance-condition change replay:** strengthen the coverage condition from seven signals to thirty and a final long-text condition. The transition is a controlled reconstruction from real maintenance requirements. Revise only its check; preserve the privacy condition and its evidence. Detect the one affected line and recheck it.
3. **Later-session handoff replay:** copy the resulting files and evidence into a fresh working directory, with no source, scope or requirement changes. Determine that no check needs to run again, using only the saved files.

The existing-flow baseline uses direct Node verification, an explicit requirement file, a small local hash/exit-record helper and saved handoff JSON. Its helper is included and counted as setup. It compares current acceptance and input hashes and **reuses unchanged evidence**, including during handoff. It does not rerun all tests or deliberately omit available metadata. This is a strong scripted operationalization of an existing files/commands/handoff practice; it is not a claim that users already maintain this exact helper.

The assisted flow uses Intake explicit review snapshots, a reviewed dependency map, ordinary Proofline `run` receipts, and targeted `query`. Count snapshot preparation, each explicit confirmation/revision, imports, mapping/config files, check edits, observations, investigation queries, corrective retries and handoff copies. Fixed task material copying is reported separately from workflow-specific setup. The shared oracle checks the same final source bytes, coverage/redaction results and exact affected/reused evidence sets for both flows.

Record each operation and phase wall time, subprocess duration, files/configuration writes, commands, actual verification executions, repeated unchanged checks, failed commands and unexpected retries. Expected pre-fix failures are reproduced defects, not false alarms. Track initial configuration, revision maintenance and later reuse separately. One ordered pair per task is sufficient for this internal screen; no significance or causal savings claim follows from timing differences on a shared host.

Report unavailable dimensions explicitly: human time, model token/context usage and active Agent reasoning/investigation time are not observable from subprocess or harness timers. Harness phase time covers the scripted replay only. Never relabel JSON bytes as tokens or command elapsed time as user acceptance time. The development session and its earlier debugging failures are outside these replay timings and must not be hidden as a full development cost comparison.

If the assisted workflow costs more, retain that result and recommend a concrete reduction in operations/configuration. Correctness takes priority; positive savings are not required. Final candidate verification and public release approval are separate from this evaluation.
