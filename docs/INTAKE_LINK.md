# Intake to Proofline file contract

Pass an explicitly selected `intake-requirements/1` file directly as `--contract reviewed-requirements.json`, or as `--from`/`--to` in Goal Delta. `doctor`, `run`, `capture`, `query` and Goal Delta share the same complete snapshot validator and normalization. Native `proofline-goal-contract/1` inputs remain supported, including mixed native/Intake comparison sides.

`proofline import-intake --input reviewed-requirements.json --output contract.json` remains an optional normalized export. Omit `--output` for read-only JSON stdout. File output refuses to overwrite an existing contract. No manifest or ledger is required to import. Direct and exported forms yield the same normalized target revision, digest and evidence meaning.

Normalization produces the existing `proofline-goal-contract/1` with optional `intake` origin metadata (`proofline-intake-origin/1`). Only current user-confirmed requirements become goal items. The entire snapshot is validated first, including unconfirmed items, unknown fields, source registry duplicates/references and confirmation against old source revisions. Origin metadata preserves scope, snapshot revision, all item IDs/revisions/confirmation dispositions, and exact current/previous pointer coordinates. Raw bodies and pointer excerpts are not copied. The validator is a versioned byte-identical copy of Intake's `src/core/requirements-schema.js`; neither runtime requires its sibling checkout.

Goal IDs retain Intake scope and identity. Goal acceptance includes the requirement revision, text and support digest; unrelated pointer movements do not change its acceptance content. An explicit revision or changed support does. Generic goal labels ensure the public Workprint projection does not silently publish private acceptance wording.

The imported snapshot records caller review decisions; it is not a human-authentication or attestation mechanism. Inputs, requirement identity and observation revision are separate. Normal `run`/`capture` with the explicit target/dependency pair records the relationship in the existing ledger. A query never attaches an old receipt to an unobserved revision: it reports the old observation revision and whether its declared dependency hashes remain compatible.

## Reproduce the complete loop

From a Proofline checkout, explicitly select both companion CLI entry points:

```sh
node scripts/mainline-loop.mjs --intake ../codex-intake/scripts/requirements.mjs --workprint ../codex-workprint/bin/codex-workprint.js --output .proofline/tmp/mainline-loop-new
```

For distribution verification, point `--intake` at an extracted Intake source candidate and add `--proofline <installed-package>/bin/proofline.js`. Workprint can be the existing compatible package or source CLI. The script checks the actually selected producer/consumer validators and runs the same loop through those entry points.

The output directory must be new. The script copies selected Intake compiler/export code into the isolated test workspace, prepares two known unconfirmed requirements, confirms their explicit IDs in one revision-checked batch, and uses the reviewed file directly. It configures two independent command checks, records normal observations, revises and confirms one requirement, queries the affected gap, updates its check, executes the returned bound argument-array proposal, and builds/verifies Workprint. It asserts that the other receipt remains exactly the same with its original observation revision. This simplified loop has 14 CLI invocations; the frozen earlier 17-invocation record remains historical.

`loop-result.json` records every CLI operation's exit code, process elapsed time and output bytes. The ledger, reviewed requirement files, dependency map and final query remain in that directory as the recovery entry; separate normalized contract copies are unnecessary. This is a synthetic local interoperability check, not a human workflow or cost-benefit result. The sibling tools are explicit test inputs.
