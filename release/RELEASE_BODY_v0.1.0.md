# Proof, not promises.

Proofline turns acceptance criteria into an inspectable graph of observed commands, files, screenshots, environments and timestamps. This is the first public preview.

## What's included

- Five explicit evidence states: **verified, missing, stale, declared-only, failed**.
- **Gap Tour:** walk each unsupported proof line, inspect its stored reason, and navigate with G / Escape. This release fixes the inspector remaining visible after Exit.
- **Goal Delta:** compare two contract revisions, follow explicit dependencies, and see which green receipts become stale while unrelated evidence stays usable.
- Self-contained HTML, Markdown and JSON reports; deterministic `workprint-profile/0.1` Goal Delta export.
- A dependency-free Node.js 20+ CLI, optional Codex Skill/Stop hook, and bundled synthetic examples.

## Try it

Download `codex-proofline-0.1.0.tgz` and run:

```sh
npm install --global ./codex-proofline-0.1.0.tgz
proofline version
proofline init
```

Or extract `codex-proofline-0.1.0-source.zip`, open an example HTML report, or run `node bin/proofline.js`. Use the source ZIP for development and the standalone Mac gate. Each archive has a SHA-256 sidecar. Distribution is through GitHub Releases; no npm registry publication is implied.

## Observed release checks

- Source commit: `45eaebd580026a3fc2a56c1e072bf50234041d67`.
- [Six hosted CI jobs passed](https://github.com/codex-improvement-lab/codex-proofline/actions/runs/33951067749): Windows/macOS × Node 20/22/24, including actual `npm pack --dry-run`, installation and packaged CLI/example smoke.
- Windows: 42/42 core tests; lint; 42-artifact release gate; official plugin/Skill validators; isolated implementation check. A clean Git clone also passed the core tests and release checks.
- Browser: 13 passing interaction checks, desktop and 390×844 views without overflow, using synthetic examples.
- The final TGZ was packed twice with identical bytes and installed locally; the CLI loop, five states, three report formats and all three exact Goal Delta projections passed.

Receipts are local and tamper-evident, not attestations. Hosted macOS CI does not establish physical-device or fresh-task Codex integration evidence. The stronger standalone real-Mac gate remains pending for this candidate; the historical targeted Lab PASS belongs to the prior exact candidate. Real-user and production validation are unobserved. [Full evidence record](https://github.com/codex-improvement-lab/codex-proofline/blob/main/release/PUBLICATION.md).
