# Codex Proofline 0.2.0-rc.1 — query and recheck an explicit target

This prerelease candidate adds read-only Goal Delta JSON and compact target queries, inspectable input/mapping configuration, and explicit contract/dependency bindings on normal command and artifact receipts. The original five states remain `verified`, `missing`, `stale`, `declared-only`, and `failed`.

Pass a native goal contract or a selected `intake-requirements/1` snapshot directly to `doctor`, `run`, `capture`, `query`, or either `goal-delta` side. All entries use the same strict complete-snapshot normalization; only current confirmed items are admitted. `import-intake` is an optional export, and mappings remain explicit.

```sh
proofline doctor --contract reviewed.json --dependencies dependencies.json --json
proofline run AC-01/tests --contract reviewed.json --dependencies dependencies.json -- node --test
proofline query --contract reviewed.json --dependencies dependencies.json --gaps
proofline goal-delta --from prior-reviewed.json --to reviewed.json --dependencies dependencies.json --json --gaps
```

Goal Delta's recheck proposals carry `executable`, `argv`, and `cwd`, including the selected manifest, target file, dependency file and normalized target digest. Pass the argument array to a subprocess API; do not treat it as a shell command. A changed target is rejected before observation. Module callers without complete path/command context receive explicit `requiredContext` and no executable proposal. The tool does not execute these proposals automatically.

Local base state and applicable target state remain distinct, and old compatible observations retain their original observation revision. New observations can close a target gap; changed, revoked, missing, failed or unbound evidence is not relabeled as a successful new verification. An observed process exit is not proof of business-test adequacy.

Local machine results and HTML action details can include selected local paths and command arguments. Public Workprint projections keep their existing whitelist and omit private bindings, pointers, arguments and acceptance text from Intake-derived labels. Long imported text and hashes wrap in narrow Goal Delta views.

The original internal maintenance screen remains **14 baseline / 29 assisted operations, no demonstrated saving**. Atomic explicit review and direct inputs reduce the assisted sequence to **22 operations** with the same baseline/oracle; it still exceeds the baseline. The complete synthetic three-product loop has 14 CLI calls instead of 17. Neither count establishes human-time, token, external-user or market benefit.

Package, lockfile, plugin metadata and CLI identify 0.2.0-rc.1. CI installs the filename returned by the actual pack command; package smoke compares the installed version with package metadata. Exact local test/package results accompany the candidate. Hosted CI and publication are performed by the product owner; historical physical-Mac or user results are not transferred.

The existing CI matrix now configures nine identical core/package/install jobs: Windows, macOS and Ubuntu × Node 20/22/24. Configuration is not a Linux validation result; the product owner binds actual hosted results to the frozen source commit before making that claim.
