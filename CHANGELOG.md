# Changelog

## Unreleased — after 0.2.0-rc.1

- Add explicit `init --command-only` scaffolding for CLI and CI maintenance. Start with one command criterion; retain input discovery, evidence states and overwrite refusal. The default scaffold continues to include a visual criterion.

## 0.2.0-rc.1 — prerelease candidate

- Normalize selected Intake snapshots consistently at every contract-file entry; validate the full source/requirement structure before admitting confirmed items. Keep explicit mappings and optional imports.
- Return recheck executable/argv/cwd with manifest, target, dependencies and target-digest precondition; refuse target drift and mark module proposals incomplete when context is absent.
- Reduce the synthetic loop from 17 to 14 CLI calls and the controlled assisted maintenance replay from 29 to 22 operations. Preserve the original 14/29 result and unchanged strong baseline; no user-time/token saving is established.
- Match package/lock/plugin versions and use actual pack output/version metadata in CI and installed-package verification.

## Unreleased — Proofline mainline candidate

- Keep full imported acceptance text and hashes inside narrow Goal Delta layouts; distinguish a dependency-bound current receipt from a pending contract recheck.

- Import scoped, explicitly confirmed Intake requirement snapshots with revision and origin dispositions; preserve generic public labels and keep private requirement text out of the Workprint projection.

- Add `doctor` configuration checks, input prefill based on existing paths, compact `query` output and explicit goal/acceptance configuration bindings on ordinary run/capture receipts. Reuse matching dependencies across revisions; require a new observation for changed ones.
- Keep mixed removed/surviving dependencies eligible for review instead of incorrectly suggesting retirement.

- Add complete, read-only `goal-delta --json` queries with explicit base/target revisions, states, reasons and dependency filters. Reject unsupported, duplicate and conflicting options.
- Keep stdout as one JSON document; queries do not generate HTML or Workprint files. Honor the existing `--at` clock for status/check/report as well as Goal Delta.


All notable changes to Codex Proofline are documented here.

## [0.1.0] — 2026-09-05

First public preview, distributed as a GitHub prerelease.

### Release preparation

- Include the documented example inputs, ledgers and generated reports in the installable package, together with release and security notes.
- Keep the maintainer's local root ledger private; public examples remain explicitly synthetic.
- Fix the Gap Tour inspector's hidden-state styling so initial load, Exit and Escape actually hide it.
- Use a fixed demo evaluation clock and preserve the historical Mac acceptance separately from the current candidate.
- Add packed-install smoke coverage on Windows/macOS with Node 20, 22 and 24; pin CI actions to reviewed commits.

### Added

- Dependency-free Node.js CLI with `init`, `run`, `capture`, `claim`, `status`, `check`, `report`, and `serve` commands.
- Append-only JSONL evidence ledger with SHA-256 receipt hashes.
- Five-state evaluator for verified, missing, stale, declared-only, and failed evidence.
- Self-contained Markdown, HTML, and JSON reports.
- Codex plugin skill and optional warn/enforce-once Stop hook.
- Windows automated test and responsive visual evidence.
- Cross-platform CI for Windows and macOS remote runs.
- Real-Mac readiness gate for spaced paths, POSIX `PLUGIN_ROOT`, local marketplace lifecycle, fresh-task Skill/Stop hook activation, and redacted evidence output.
- Gate v2 replacement-candidate identity: source content hashing, direct installed-cache byte/CLI checks, and independent one-time Skill and Stop-hook receipts that do not depend on model prose repeating a version.
- Forensic Gap Tour for walking every non-verified proof line from the stored status and reason, with keyboard navigation and no evidence promotion.
- Product-specific design direction and report regression coverage for the gap inspection controls.
- Status-faithful Gap Tour inspector colors plus explicit next/exit controls, so mouse users can complete the same evidence walk as keyboard users.
- Goal Delta CLI loop for comparing two explicit goal/acceptance revisions and propagating impact only through complete, explicit evidence dependency mappings.
- Deterministic self-contained Goal Delta HTML with a revision redline, contract fault, traceable evidence shockwave, rerun/retire instructions, and responsive 390×844 layout.
- `workprint-profile/0.1` public projection for Goal Delta, without absolute machine paths, receipt internals, or command output.
- Three fixed-clock Goal Delta scenarios covering an all-green-to-stale launch target shift, unrelated incident evidence isolation, and added/removed release-contract items.

### Fixed

- Included the checked-in `PROOFLINE_REPORT.md` in the public package allowlist and release contract, keeping the README link and packaged release materials self-consistent.
