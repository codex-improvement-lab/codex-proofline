# Proofline · Northstar v1.4 release

> **EVIDENCE GAPS** · 2/6 acceptance criteria verified · 2/6 proof lines verified

Generated: 2026-08-22T09:16:57.115Z

| Acceptance criterion | Status | Proof lines |
| --- | --- | --- |
| AC-01 — The automated release checks pass on the observed environment. | ✓ Verified | 1/1 |
| AC-02 — The release note artifact matches the captured receipt. | ✓ Verified | 1/1 |
| AC-03 — The primary workflow has current Windows visual evidence. | ◷ Stale | 0/1 |
| AC-04 — The release flow is verified on a physical macOS device. | ! Declared only | 0/1 |
| AC-05 — The packaging smoke test exits successfully. | × Failed | 0/1 |
| AC-06 — The pull request includes a reviewer-facing proof report. | ○ Missing | 0/1 |

## ✓ AC-01 · Verified

The automated release checks pass on the observed environment.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Release check suite `.\\\\fixtures\\\\pass.cmd` | command | ✓ Verified | observed 7m ago · 2026-08-22T09:09:32.263Z | Windows 11 / local command shim / automated | exit 0 · 28ms · stdout bbd577e8f7d9 · inputs aa8a226ddd08 · receipt 9281dfe51a5a |

## ✓ AC-02 · Verified

The release note artifact matches the captured receipt.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Release note artifact | file | ✓ Verified | observed 12m ago · 2026-08-22T09:04:18.430Z | win32 10.0.26200 | release/notes.md · 167 bytes · file d16f8271ff42 · receipt f4bc05f55749 |

## ◷ AC-03 · Stale

The primary workflow has current Windows visual evidence.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Windows overview | screenshot | ◷ Stale | observed 583d ago · 2025-01-15T12:00:00.000Z · logged 2026-08-22T09:16:57.036Z | Windows 11 / Chromium / automated browser | evidence/product-overview.png · 75212 bytes · file ed4938f4b841 · receipt f403a91060b7 |
| ↳ Evidence is older than 24h. |  |  |  |  |  |

## ! AC-04 · Declared only

The release flow is verified on a physical macOS device.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Physical macOS release flow | screenshot | ! Declared only | declared 12m ago · 2026-08-22T09:04:19.286Z | — | Awaiting physical macOS device validation; Windows automation is not a substitute. |
| ↳ Declared, not observed: Awaiting physical macOS device validation; Windows automation is not a substitute. |  |  |  |  |  |

## × AC-05 · Failed

The packaging smoke test exits successfully.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| Package smoke test `.\\\\fixtures\\\\fail.cmd` | command | × Failed | observed 7m ago · 2026-08-22T09:09:32.736Z | Windows 11 / local command shim / automated | exit 2 · 28ms · stdout e3b0c44298fc · inputs 824a5cb75d5b · receipt be60150b0c5a |
| ↳ Command exited 2; expected exit 0. |  |  |  |  |  |

## ○ AC-06 · Missing

The pull request includes a reviewer-facing proof report.

| Proof line | Kind | Status | Evidence time | Environment | Receipt |
| --- | --- | --- | --- | --- | --- |
| PR proof report | file | ○ Missing | — | — | No receipt |
| ↳ No evidence has been recorded. |  |  |  |  |  |

---

Proofline receipts are local, tamper-evident records—not cryptographic attestations. A screenshot receipt proves the captured file bytes, timestamp, and declared environment label; it does not by itself prove visual correctness, physical-device use, external-platform state, or real-user validation.
