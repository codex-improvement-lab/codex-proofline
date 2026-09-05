# Codex Proofline 0.1.0 — first public preview

Codex Proofline turns an agent's “done” into a reviewer-facing proof graph. Each acceptance criterion connects to observed command, file, or screenshot receipts with environment and timestamp metadata.

## Highlights

- One local CLI, no runtime dependencies or hosted account.
- Five states that separate proof from assertion: verified, missing, stale, declared-only, and failed.
- Command receipts retain exit codes and output hashes without storing raw command output.
- Artifact receipts detect missing or changed bytes.
- Self-contained HTML report with status filters, plus Markdown for pull requests and JSON for automation.
- Gap Tour with keyboard navigation and working Exit/Escape behavior at desktop and narrow viewports.
- Goal Delta contract revision reports: explicit dependency propagation, existing `stale` semantics, an impact-first redline/shockwave visual, and a deterministic Workprint projection.
- Optional Codex skill and completion hook without making the plugin a prerequisite.
- Exact real-Mac readiness handoff with a pinned source candidate, direct installed-cache identity, deterministic fresh-session Skill/Stop-hook receipts, cleanup, and redacted evidence.
- Source ZIP and installable TGZ with all five-state and Goal Delta examples, plus SHA-256 sidecars.

## Evidence boundary

Receipts are local and tamper-evident, not cryptographic attestations. Current Windows automation and synthetic browser checks are recorded in [the publication record](release/PUBLICATION.md), which also links the observed GitHub Actions runs and distributed asset hashes. Hosted macOS CI does not establish physical-device or fresh-task Codex integration evidence. Real-user and production validation remain unobserved.

The superseded Mac candidate reached Skill activation but exposed a brittle gate assertion that expected the model to repeat a version string. Gate v2 removes that assertion. The replacement candidate later passed the narrower targeted Lab acceptance scope, but the complete standalone gate-v2 sequence has not run; installed-cache, fresh-task Skill/Stop-hook, and cleanup claims therefore remain pending.

A later five-project physical-Mac acceptance run observed Proofline's tests, implementation check, and Gap Tour working, but correctly failed the bundled candidate because `PROOFLINE_REPORT.md` had been omitted while the release gate and README required it. After the file was added to the package allowlist and release contract, an external targeted Mac report for exact prior candidate `codex-proofline-macos-rc-9bdf7995a611f15e` recorded 34 passes, zero failures, one expected Windows-only skip, and the then-current 28/28 release files. That prior candidate passed the Lab's targeted acceptance scope; Goal Delta source changes do not inherit the result.

That narrower result does not claim the separate gate-v2 installed-cache identity, fresh-task Skill/Stop-hook receipts, or cleanup sequence. Standalone full-gate macOS validation remains pending and must not be inferred from the Lab report.

## Upgrade path

This is the first public preview, published as the GitHub prerelease `v0.1.0`. Install the downloaded `codex-proofline-0.1.0.tgz` with `npm install --global ./codex-proofline-0.1.0.tgz`, or run `node bin/proofline.js` from the source ZIP. No npm registry publication is implied. The manifest and JSON report both use schema version `1`; future incompatible changes will require an explicit migration.
