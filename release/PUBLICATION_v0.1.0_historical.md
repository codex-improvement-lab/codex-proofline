# Proofline v0.1.0 public preview

Release date: 2026-09-05.

Repository: [codex-improvement-lab/codex-proofline](https://github.com/codex-improvement-lab/codex-proofline).
Distribution: [GitHub prerelease v0.1.0](https://github.com/codex-improvement-lab/codex-proofline/releases/tag/v0.1.0), source ZIP and installable TGZ with SHA-256 sidecars.

Published at `2026-09-05T06:56:41Z`. Tag `v0.1.0` identifies source commit `45eaebd580026a3fc2a56c1e072bf50234041d67`. The public release and all four attached files were retrieved without authentication; sizes and SHA-256 values matched. See the [machine-readable publication receipt](publication-v0.1.0.json).

## Observed hosted CI and assets

[GitHub Actions run 33951067749](https://github.com/codex-improvement-lab/codex-proofline/actions/runs/33951067749) passed all six Windows/macOS × Node 20/22/24 jobs for that exact source commit. Each job passed the core suite, demo regeneration, release gate, actual npm dry run, and installation of the packed CLI. [Job and step evidence](ci-v0.1.0.json).

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `codex-proofline-0.1.0-source.zip` | 902664 | `b8cb91dde17582ffed82a8ff42abb6f0fda16965a10dad2dee21e0f2c9d9d2d7` |
| `codex-proofline-0.1.0.tgz` | 821643 | `7b8a0a186dda7581ec42eee664c503c1fd15e38c6f90ec7a0a1976ce45f00b6b` |

The installable package contains 96 files. Two packs from the same clean source clone were byte-identical. Its installed command shim returned `0.1.0`; the installed CLI loop and all bundled scenario projections passed.

## Release content

- Dependency-free Node.js 20+ CLI and five-state acceptance-to-evidence reports.
- Gap Tour, including the hidden-state styling fix for initial load, Exit and Escape.
- Goal Delta with explicit dependency propagation, three fixed-clock scenarios, and a deterministic Workprint projection.
- Optional Codex Skill and Stop hook; hooks remain subject to host trust review.
- Synthetic example ledgers and offline HTML reports included in both distribution formats.

## Evidence at the source freeze

The [browser record](../docs/evidence/publication-2026-09-05/browser-qa.json) records 13 passing interactions and four desktop/narrow views without overflow. Screenshots and their hashes are retained beside it. This is Windows automation using synthetic examples.

Windows Node 24.19.0 passed 42/42 core tests. The Windows implementation probe passed source identity, environment-contract rejection, the CLI/report loop, direct hook behavior, isolated marketplace installation, cached-plugin identity and cleanup. Its [redacted receipt](../docs/evidence/publication-2026-09-05/implementation.json) explicitly marks fresh-task Skill/Stop-hook activation as not run. The 42-artifact release gate and official plugin/Skill validators passed.

Actual local packing and an isolated installed-package smoke exercised the CLI loop, all five states, three report formats and all three exact Goal Delta projections. The hosted CI workflow runs Windows/macOS with Node 20/22/24, including an actual npm package dry run and installed package smoke. The source snapshot's self-proof report is generated before remote CI; it can therefore retain a declared CI boundary. The final release body and subsequent publication receipt bind the actual hosted runs and downloaded assets to the tag.

The machine-local root ledger is intentionally excluded from Git and packages. Public synthetic example ledgers are included. Original local receipts were not rewritten to conceal paths.

## Physical-Mac boundary

Historical candidate `codex-proofline-macos-rc-9bdf7995a611f15e` retains the targeted Lab result: 34 passes, zero failures, one expected Windows-only skip and the then-current 28-file release gate. Its raw report bytes are preserved. The current candidate identity is in [`macos-replacement-candidate.json`](../docs/evidence/macos-replacement-candidate.json); no earlier Mac PASS is imported into it.

The stronger standalone physical-Mac gate-v2 sequence, including installed-cache identity and fresh-task Skill/Stop-hook receipts, remains pending for the current candidate. Hosted macOS CI, Windows viewport checks and a successful GitHub release do not satisfy that gate. Real-user and production validation are unobserved.
