# Internal maintenance replay results — 2026-09-08

The assisted flow met the same bounded correctness checks as the strong file-based baseline, but **did not reduce operations or measured scripted time** in this screen. Keep the evidence-binding/query capability; treat the Intake bridge as an optional review interchange until its extra confirmation/import work is reduced. This is a recommendation for product review, not a change to the commissioned direction.

Evidence: [frozen protocol](MAINLINE_EVALUATION_PROTOCOL.md), [measurement JSON](evidence/mainline-2026-09-08/measurement.json), and [separate synthetic CLI interoperability record](evidence/mainline-2026-09-08/interoperability.json). Reproduce with `node scripts/measure-mainline.mjs --intake-root ../codex-intake --output .proofline/tmp/new-measurement-directory` from this repository.

## What was actually compared

The task material comes from the actual Intake coverage defect, the observed pre-fix commit `88cc6abf548b1b5a3fb8dfd6213c76df923aa3da`, M1 fix `fe4002b`, and their seven/30-signal and long-condition regression cases. This is a **non-blind controlled maintenance replay**. The ordering of the strengthened acceptance condition and later handoff is reconstructed for measurement, not a claim that the historical conversation followed this sequence. No external user was involved.

Both flows receive the same selected source/check files, apply the same known fix, and run identical independent coverage/redaction checks. The baseline is direct Node verification plus a small local helper storing exit outcomes, exact input/acceptance hashes and a handoff file. It is deliberately able to reuse unchanged evidence; its helper and explicit configuration are counted. It operationalizes a careful existing files/commands/handoff practice and does not claim to describe every user's usual process.

## Recorded costs

| Phase | Baseline operations / CLI calls | Assisted operations / CLI calls | Baseline scripted wall ms | Assisted scripted wall ms |
| --- | ---: | ---: | ---: | ---: |
| First configuration | 2 / 0 | 12 / 5 | 1.8 | 438.6 |
| Defect reproduction, same known fix, acceptance | 5 / 4 | 5 / 4 | 535.9 | 664.1 |
| Strengthened acceptance and necessary recheck | 5 / 3 | 10 / 6 | 431.8 | 613.7 |
| Later session with unchanged files | 2 / 1 | 2 / 1 | 151.8 | 169.7 |
| Sum of these scripted phases | 14 / 8 | 29 / 16 | 1121.2 | 1886.1 |

An operation is one workflow entry-point invocation or one explicit configuration/maintenance/copy write. The JSON lists each one. Nested test execution is also separately counted: both flows ran three checks in defect acceptance (including one expected pre-fix failure), one changed check after the acceptance revision, and zero checks during handoff. Neither reran the unaffected privacy check after revision or during handoff. There were zero unexpected command retries in this measured replay.

The setup timer measures writing/compiling already-specified configuration, **not** authoring or reviewing it. Shared supplied fixture copying is listed separately and excluded from both phase sums. The helper is visible in the reproduction script rather than treated as free preexisting user software. The assisted flow's explicit confirmations, intermediate snapshot writes, imports, mappings, configuration inspection and rechecks are all counted. The result is not evidence that setup takes a user 1.8 or 438.6 milliseconds.

Subprocess wall time (including nested checks) is separately recorded from phase/harness wall time. Human time, active Agent investigation/reasoning time, model/context tokens and end-to-end user acceptance time are **unavailable**. Output byte counts are diagnostics, not tokens. This one ordered pair on a shared Windows/Node 24.19.0 host does not estimate causal user savings, population averages or statistical significance.

## Correctness and limits

All three task classes passed the same final checks in both flows. The old compiler reproduced its known failure; the fixed compiler represented all seven requirements and later all thirty with the final long-text condition. Exactly the coverage line became affected after the acceptance change. Privacy evidence kept its exact original execution identity. The new-directory handoff recovered the correct no-rerun decision from files. False negatives and false positives were zero **over these fixed expected sets**, not over arbitrary requirements.

Separate regressions cover candidate/revoked requirements being excluded from imports, changed/ambiguous/masked source signals not inheriting confirmation, old references requiring an explicit keep decision, foreign scope rejection, old unbound observations remaining stale for a target-only query, and correct recovery after explicit target-bound re-observation. They are software correctness tests, not extra real-user samples.

The earlier 17-operation full Intake → Proofline → Workprint loop is a synthetic interoperability check. Its count is not proof of low cost. Its public projection and Workprint verification passed, but Workprint export is not included as a claimed advantage in this equal-result acceptance/handoff comparison.

Development/debugging cost is outside the replay, so these numbers must not be presented as total engineering cost. Before measurement, an existing browser expectation needed the corrected candidate count, the new test initially mishandled an empty `open` attribute, and a real narrow-layout regression was fixed; those retries are documented in the development status and final checks. The measured replay itself passed on its first invocation.

## Concrete simplifications to review

1. Support one explicit list of selected requirement IDs in a review operation, preserving each decision and avoiding an implicit confirm-all. This would remove repeated confirmation commands and intermediate snapshot files during initial setup.
2. Allow the explicitly selected Intake snapshot to be normalized directly as a Proofline contract input. Keep its digest/revision binding; remove the separate import invocation and duplicate contract write from initial setup and every revision.
3. Keep the bridge optional for an already clear, small requirement set. Do not require all normal tasks to produce the full multi-product export loop. Retain Proofline's ordinary run receipt and targeted query as the main execution path.

These are bounded next options, not implemented savings. No external adoption, retention, user-time benefit, physical-Mac PASS or new hosted-CI claim follows from this local candidate.
