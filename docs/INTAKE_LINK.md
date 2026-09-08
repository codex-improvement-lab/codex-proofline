# Intake to Proofline file contract

`proofline import-intake --input reviewed-requirements.json --output contract.json` consumes an explicitly selected `intake-requirements/1` snapshot. Omit `--output` for read-only JSON stdout. File output refuses to overwrite an existing contract. No manifest or ledger is required to import.

The result is the existing `proofline-goal-contract/1` with optional `intake` origin metadata (`proofline-intake-origin/1`). Only current user-confirmed requirements become goal items. Origin metadata preserves scope, snapshot revision, all item IDs/revisions/confirmation dispositions, and exact current/previous pointer coordinates. Raw bodies and pointer excerpts are not copied.

Goal IDs retain Intake scope and identity. Goal acceptance includes the requirement revision, text and support digest; unrelated pointer movements do not change its acceptance content. An explicit revision or changed support does. Generic goal labels ensure the public Workprint projection does not silently publish private acceptance wording.

The imported snapshot records caller review decisions; it is not a human-authentication or attestation mechanism. Inputs, requirement identity and observation revision are separate. Normal `run`/`capture` with the explicit target/dependency pair records the relationship in the existing ledger. A query never attaches an old receipt to an unobserved revision: it reports the old observation revision and whether its declared dependency hashes remain compatible.

## Reproduce the complete loop

From a Proofline checkout, explicitly select both companion CLI entry points:

```sh
node scripts/mainline-loop.mjs --intake ../codex-intake/scripts/requirements.mjs --workprint ../codex-workprint/bin/codex-workprint.js --output .proofline/tmp/mainline-loop-new
```

The output directory must be new. The script copies selected Intake compiler/export code into the isolated test workspace, prepares unconfirmed requirements, explicitly confirms them, configures two independent command checks, records normal observations, revises one requirement, queries the single affected gap, updates its check, re-observes it, and builds/verifies Workprint. It asserts that the other receipt remains exactly the same with its original observation revision.

`loop-result.json` records every CLI operation's exit code, process elapsed time and output bytes. The ledger, requirements, contracts, dependency map and final query remain in that directory as the recovery entry. This is a synthetic local interoperability check, not a human workflow or cost-benefit result. The sibling tools are test inputs; Proofline's runtime has no sibling repository dependency.
