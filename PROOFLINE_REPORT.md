# Proofline · Codex Proofline 0.1.0 release candidate

Post-publication local snapshot. Hosted CI supports the exact tagged source commit; file receipts bind the retained API result bytes. See [the publication record](release/PUBLICATION.md). The stronger current physical-Mac gate remains pending and is separate from this public preview's release gate.

Pre-publication local snapshot. Later exact-commit hosted CI and distribution results are recorded in [the publication record](release/PUBLICATION.md). The remaining physical-Mac gate is separate from this public preview's release gate.

> **EVIDENCE GAPS** · 6/8 acceptance criteria verified · 6/9 proof lines verified

Generated: 2026-09-05T06:51:20.531Z

| Acceptance criterion | Status | Proof lines |
| --- | --- | --- |
| AC-01 — The automated core suite passes against the current source inputs on Windows. | ✓ Verified | 1/1 |
| AC-02 — The local release-file gate passes against current package and documentation inputs. | ✓ Verified | 1/1 |
| AC-03 — The npm-compatible package can be packed locally with the release allowlist. | ✓ Verified | 1/1 |
| AC-04 — The desktop proof graph has current automated Windows visual evidence. | ✓ Verified | 1/1 |
| AC-05 — The local marketplace, fresh-task Skill/Stop hook, and core workflow pass on a real Mac. | ! Declared only | 0/2 |
| AC-06 — The declared GitHub Actions Windows and macOS matrix has an observed external run. | ! Declared only | 0/1 |
| AC-07 — Public maintainer identity and repository metadata are owner-confirmed. | ✓ Verified | 1/1 |
| AC-08 — The non-macOS implementation probe exercises marketplace lifecycle, spaced paths, contracts, reports, hook logic, cleanup, and evidence redaction without satisfying the real-Mac gate. | ✓ Verified | 1/1 |

## ✓ AC-01 · Verified

The automated core suite passes against the current source inputs on Windows.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Node test suite `node --test --test-reporter=spec` | command | ✓ Verified | observed just now · 2026-09-05T06:50:20.652Z | Windows 11 Home build 26200 / Node 24.19.0 / automated | exit 0 · 2.77s · stdout b8e1e3cded25 · inputs 4d35dd24ae40 · receipt 8dd4094ac147 |

## ✓ AC-02 · Verified

The local release-file gate passes against current package and documentation inputs.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Release file gate `node scripts/release-check.mjs` | command | ✓ Verified | observed just now · 2026-09-05T06:51:19.144Z | Windows 11 Home build 26200 / Node 24.19.0 / automated | exit 0 · 96ms · stdout 8cc1a79f44c9 · inputs a324de7d6294 · receipt 5d7b1bc70ca4 |

## ✓ AC-03 · Verified

The npm-compatible package can be packed locally with the release allowlist.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Actual pnpm package creation `pnpm.cmd pack --pack-destination .proofline/tmp/publication-2026-09-05/freeze-pack` | command | ✓ Verified | observed just now · 2026-09-05T06:51:20.060Z | Windows 11 Home build 26200 / pnpm 11.19.0 / automated | exit 0 · 734ms · stdout 6178cb3254ad · inputs 792af4b8bd94 · receipt 271e7b9b7d03 |

## ✓ AC-04 · Verified

The desktop proof graph has current automated Windows visual evidence.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Desktop proof graph | screenshot | ✓ Verified | observed just now · 2026-09-05T06:51:20.211Z | Windows 11 build 26200 / CUA browser / automated viewport | docs/evidence/publication-2026-09-05/proof-desktop.jpg · 76175 bytes · file 7825a45794f8 · receipt 941a210fec09 |

## ! AC-05 · Declared only

The local marketplace, fresh-task Skill/Stop hook, and core workflow pass on a real Mac.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Real-Mac readiness gate | command | ! Declared only | declared 12d ago · 2026-08-23T10:26:17.120Z | — | Implementation is ready; awaiting execution of docs/MACOS_HANDOFF.md on a real Mac. |
| ↳ Declared, not observed: Implementation is ready; awaiting execution of docs/MACOS_HANDOFF.md on a real Mac. |  |  |  |  |  |
| Redacted real-Mac gate receipt | file | ! Declared only | declared 12d ago · 2026-08-23T10:26:17.217Z | — | No docs/evidence/macos-readiness.json from a real Mac has been received. |
| ↳ Declared, not observed: No docs/evidence/macos-readiness.json from a real Mac has been received. |  |  |  |  |  |

## ! AC-06 · Declared only

The declared GitHub Actions Windows and macOS matrix has an observed external run.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| External CI matrix result | file | ! Declared only | declared just now · 2026-09-05T06:51:20.319Z | — | This local source snapshot precedes hosted CI. Consult release/PUBLICATION.md and the published release for later exact-commit observations. |
| ↳ Declared, not observed: This local source snapshot precedes hosted CI. Consult release/PUBLICATION.md and the published release for later exact-commit observations. |  |  |  |  |  |

## ✓ AC-07 · Verified

Public maintainer identity and repository metadata are owner-confirmed.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Confirmed public metadata | file | ✓ Verified | observed just now · 2026-09-05T06:51:20.419Z | win32 10.0.26200 | release/public-metadata.json · 599 bytes · file 64bf41dc22bb · receipt f016cb7dbd39 |

## ✓ AC-08 · Verified

The non-macOS implementation probe exercises marketplace lifecycle, spaced paths, contracts, reports, hook logic, cleanup, and evidence redaction without satisfying the real-Mac gate.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Windows Mac-gate implementation check `node scripts/macos-readiness.mjs --implementation-check --output .proofline/tmp/publication-2026-09-05/implementation.json` | command | ✓ Verified | observed just now · 2026-09-05T06:50:26.520Z | Windows 11 Home build 26200 / Codex CLI 0.145.0 / non-macOS implementation check | exit 0 · 5.71s · stdout 8c8c301bc862 · inputs fb9a6f2c9028 · receipt 6be21f2385b5 |

---

Proofline receipts are local, tamper-evident records—not cryptographic attestations. A screenshot receipt proves the captured file bytes, timestamp, and declared environment label; it does not by itself prove visual correctness, physical-device use, external-platform state, or real-user validation.
