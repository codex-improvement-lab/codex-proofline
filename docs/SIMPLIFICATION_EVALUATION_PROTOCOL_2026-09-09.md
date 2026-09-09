# Simplification replay protocol — 2026-09-09

This extends the frozen [original protocol](MAINLINE_EVALUATION_PROTOCOL.md). The original 14/29-operation result, source bytes, helper, oracle and [result file](evidence/mainline-2026-09-08/measurement.json) remain unchanged. New measurements go into a new output directory and separate checked-in result file.

Run `scripts/measure-mainline.mjs --flow simplified` with the same explicit Intake checkout and new `.proofline/tmp/` output directory. The script refuses drift in the original pre-fix source, fixed source, or baseline helper hashes. The baseline implementation and the three correctness cases are unchanged: reproduce the known defect, apply the same fixed source, strengthen the same acceptance condition, and hand off unchanged files without repeat checks.

Only the assisted procedure changes: confirm its two explicitly selected synthetic requirement IDs in one revision-checked batch; pass the saved reviewed Intake snapshot directly as the Proofline contract; omit separate import calls and duplicate normalized contract files. The requirement revision is still separately reviewed and confirmed. Count all remaining snapshot/configuration writes, queries, observations, fixes and retries under the original definitions. Do not combine a CLI call and an explicit harness file write into one operation to improve the count.

The complete synthetic CLI loop also executes the returned bound recheck argument array. That verifies execution context and target-drift refusal; it does not introduce an executor or change this maintenance comparison's oracle. Workprint's public Profile contract remains separate.

Compare the new baseline/assisted pair and list which operations were deleted relative to the original assisted flow. Retain negative results if the assisted flow still costs more. Subprocess and harness times are not human or Agent investigation time; model/context token measurements remain unavailable. This remains a non-blind controlled replay of actual maintenance material, not an external-user, causal or statistical benefit claim.
