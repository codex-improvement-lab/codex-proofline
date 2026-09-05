# Proofline · Codex Proofline 0.1.0 release candidate

Historical local snapshot from 2026-08-26. This is not the current public release verdict. In particular, the old pnpm dry-run label below does not establish an actual npm dry run; current package checks are described in the publication record.

> **EVIDENCE GAPS** · 5/8 acceptance criteria verified · 5/9 proof lines verified

Generated: 2026-08-26T17:14:22.830Z

| Acceptance criterion | Status | Proof lines |
| --- | --- | --- |
| AC-01 — The automated core suite passes against the current source inputs on Windows. | ✓ Verified | 1/1 |
| AC-02 — The local release-file gate passes against current package and documentation inputs. | ✓ Verified | 1/1 |
| AC-03 — The npm-compatible package contents pass a current dry run. | ✓ Verified | 1/1 |
| AC-04 — The desktop proof graph has current automated Windows visual evidence. | ✓ Verified | 1/1 |
| AC-05 — The local marketplace, fresh-task Skill/Stop hook, and core workflow pass on a real Mac. | ! Declared only | 0/2 |
| AC-06 — The declared GitHub Actions Windows and macOS matrix has an observed external run. | ! Declared only | 0/1 |
| AC-07 — Public maintainer identity and repository metadata are owner-confirmed. | ! Declared only | 0/1 |
| AC-08 — The non-macOS implementation probe exercises marketplace lifecycle, spaced paths, contracts, reports, hook logic, cleanup, and evidence redaction without satisfying the real-Mac gate. | ✓ Verified | 1/1 |

## ✓ AC-01 · Verified

The automated core suite passes against the current source inputs on Windows.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Node test suite `node --test --test-reporter=spec` | command | ✓ Verified | observed just now · 2026-08-26T17:14:18.928Z | Windows 11 Home build 26200 / Node 24.19.0 / automated | exit 0 · 1.85s · stdout 6b2b90dface0 · inputs 3e7110948d79 · receipt 62e72e1158ee |

## ✓ AC-02 · Verified

The local release-file gate passes against current package and documentation inputs.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Release file gate `node ./scripts/release-check.mjs` | command | ✓ Verified | observed just now · 2026-08-26T17:14:19.088Z | Windows 11 Home build 26200 / Node 24.19.0 / automated | exit 0 · 62ms · stdout ae9e8adf50c3 · inputs 6e3ae2181f98 · receipt 8a73fc824a78 |

## ✓ AC-03 · Verified

The npm-compatible package contents pass a current dry run.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| pnpm pack dry run `pnpm pack --dry-run` | command | ✓ Verified | observed just now · 2026-08-26T17:14:19.544Z | Windows 11 Home build 26200 / pnpm 11.19.0 / automated | exit 0 · 365ms · stdout d5512180f599 · inputs 86700053c9cd · receipt 5aba11346dbd |

## ✓ AC-04 · Verified

The desktop proof graph has current automated Windows visual evidence.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Desktop proof graph | screenshot | ✓ Verified | observed 4d ago · 2026-08-22T09:17:43.804Z | Windows 11 Home build 26200 / Codex in-app browser / automated viewport | docs/evidence/proofline-overview.png · 75212 bytes · file ed4938f4b841 · receipt 9edf4366d97f |

## ! AC-05 · Declared only

The local marketplace, fresh-task Skill/Stop hook, and core workflow pass on a real Mac.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Real-Mac readiness gate | command | ! Declared only | declared 3d ago · 2026-08-23T10:26:17.120Z | — | Implementation is ready; awaiting execution of docs/MACOS_HANDOFF.md on a real Mac. |
| ↳ Declared, not observed: Implementation is ready; awaiting execution of docs/MACOS_HANDOFF.md on a real Mac. |  |  |  |  |  |
| Redacted real-Mac gate receipt | file | ! Declared only | declared 3d ago · 2026-08-23T10:26:17.217Z | — | No docs/evidence/macos-readiness.json from a real Mac has been received. |
| ↳ Declared, not observed: No docs/evidence/macos-readiness.json from a real Mac has been received. |  |  |  |  |  |

## ! AC-06 · Declared only

The declared GitHub Actions Windows and macOS matrix has an observed external run.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| External CI matrix result | screenshot | ! Declared only | declared 4d ago · 2026-08-22T09:17:43.995Z | — | Workflow is configured locally, but no GitHub remote or external CI run exists. |
| ↳ Declared, not observed: Workflow is configured locally, but no GitHub remote or external CI run exists. |  |  |  |  |  |

## ! AC-07 · Declared only

Public maintainer identity and repository metadata are owner-confirmed.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Confirmed public metadata | file | ! Declared only | declared 4d ago · 2026-08-22T09:17:44.091Z | — | Maintainer identity, contact details, repository URLs, and publisher account remain owner-controlled. |
| ↳ Declared, not observed: Maintainer identity, contact details, repository URLs, and publisher account remain owner-controlled. |  |  |  |  |  |

## ✓ AC-08 · Verified

The non-macOS implementation probe exercises marketplace lifecycle, spaced paths, contracts, reports, hook logic, cleanup, and evidence redaction without satisfying the real-Mac gate.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Windows Mac-gate implementation check `node ./scripts/macos-readiness.mjs --implementation-check --output ./.proofline/tmp/macos-readiness-implementation.json --expected-content-sha256 82a95ab56ccba6aa2374f598796e24a287e1588ce7e4f3b9310ca118f3b27d20` | command | ✓ Verified | observed just now · 2026-08-26T17:14:22.646Z | Windows 11 Home build 26200 / Codex CLI 0.145.0 / non-macOS implementation check | exit 0 · 3.01s · stdout f97b4a25318e · inputs 3fffed0afe66 · receipt 98f84c9b46b0 |

---

Proofline receipts are local, tamper-evident records—not cryptographic attestations. A screenshot receipt proves the captured file bytes, timestamp, and declared environment label; it does not by itself prove visual correctness, physical-device use, external-platform state, or real-user validation.
