# Goal Delta examples

These are deterministic local fixtures. They are not production, external-platform, physical-device, or real-user evidence. Every report uses the fixed clock `2026-08-30T08:00:00.000Z`, and every evidence line is mapped explicitly to one or more contract item IDs.

| Scenario | Contract movement | Expected impact |
| --- | --- | --- |
| `checkout-shockwave` | One launch-load target tightens. | A 4/4-green baseline becomes 2/4 usable; exactly the two dependent performance receipts become `stale`. |
| `incident-isolation` | On-call acknowledgement tightens from five minutes to three. | The acknowledgement rehearsal becomes `stale`; restore, notice, and timeline evidence remain `verified`. |
| `release-surface` | Legacy XML export is removed and keyboard acceptance is added. | The legacy proof becomes `stale` and should be retired; the added item is detected as uncovered; unrelated web and package proofs remain `verified`. |

Regenerate all ledgers, self-contained HTML reports, and Workprint projections:

```sh
node ./scripts/build-goal-delta-examples.mjs
```

Run the signature scenario through the public CLI:

```sh
node ./bin/proofline.js goal-delta \
  --manifest ./examples/goal-delta/checkout-shockwave/proofline.json \
  --from ./examples/goal-delta/checkout-shockwave/contracts/before.json \
  --to ./examples/goal-delta/checkout-shockwave/contracts/after.json \
  --dependencies ./examples/goal-delta/checkout-shockwave/dependencies.json \
  --output ./examples/goal-delta/checkout-shockwave/goal-delta-report.html \
  --profile-output ./examples/goal-delta/checkout-shockwave/goal-delta.workprint.json \
  --at 2026-08-30T08:00:00.000Z
```

On PowerShell, use backticks or place the command on one line instead of the POSIX continuations above.

