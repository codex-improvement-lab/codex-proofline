# Simplification results

**The original result remains 14 baseline / 29 assisted operations, with no demonstrated saving. The new same-baseline replay is 14 / 22: seven assisted operations were removed, but the assisted flow still exceeds the strong baseline.** Human-time and model-token benefits remain unmeasured.

Evidence: [new protocol](SIMPLIFICATION_EVALUATION_PROTOCOL_2026-09-09.md), [new operation records](evidence/simplification-2026-09-09/measurement.json), [simplified synthetic interoperability record](evidence/simplification-2026-09-09/interoperability.json), and [unchanged original result](MAINLINE_EVALUATION.md). The script verified the original baseline helper, pre-fix source and fixed source hashes before measuring. The original result file's SHA-256 is recorded in the new file.

| Phase | Strong baseline | Original assisted | Simplified assisted |
| --- | ---: | ---: | ---: |
| Initial configuration | 2 | 12 | 7 |
| Known defect reproduction, same fix and acceptance | 5 | 5 | 5 |
| Acceptance change and necessary recheck | 5 | 10 | 8 |
| Unchanged later-session handoff | 2 | 2 | 2 |
| Total operations | 14 | 29 | 22 |

Initial setup removes a repeated confirmation command, two intermediate writes, a separate import command and its contract write. Revision maintenance removes another import command and contract write. The new assisted flow has 13 CLI invocations and nine explicit configuration/maintenance/copy operations; the baseline has eight and six. No remaining setup or confirmation operation was excluded to improve the count.

Both new flows passed the same fixed correctness oracle. They reproduced the known old failure, verified the identical fix, identified only the strengthened coverage requirement, preserved the privacy check's exact execution identity, and performed no unchanged checks during handoff. There were no unexpected retries in the measured run. False-positive/negative counts are zero only for these fixed expected sets.

The new harness phase sums are approximately 751ms baseline / 1387ms assisted. They are scripted wall times on one shared Windows host, not human acceptance or Agent investigation time. Do not compare these timestamps across days as a causal performance result. Output bytes are not tokens; active Agent/human and model/context token measurements remain unavailable.

The separate complete Intake → Proofline → Workprint synthetic loop now takes 14 CLI invocations, compared with the frozen 17-invocation version. It also actually executes a returned argument-array recheck. Regression tests cover nondefault manifests, a different caller directory, run and capture recovery, and refusal after target drift. Public Profile projection is unchanged by the private executable/argv/cwd fields.

This supports releasing a narrower, inspectable workflow candidate, not an efficiency, adoption, retention, physical-device or market claim. Intake remains optional for already-clear tasks. The next product decision belongs to the Lab product owner.
