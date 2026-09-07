# Query an explicit evidence context

`status --json` describes current local observations. Its `context` carries a manifest content revision and explicitly has no target contract revision. It does not establish that an old observation applies to a new goal.

`query` always writes one JSON document to stdout, does not write files, and excludes command tokens and full receipt records. It carries the manifest revision, target contract revision/digest (if supplied), evidence IDs and receipt identities, base and target states, reasons, input tracking and declared dependencies. Summary counts cover the complete project; returned rows honor all filters. Unmapped target items remain visible in `unmappedItems` even when filtering rows.

```sh
proofline query --gaps
proofline query --contract target.json --dependencies dependencies.json --gaps
proofline query --contract target.json --dependencies dependencies.json --item G-01
```

Supported filters are `--gaps`, `--status verified|missing|stale|declared-only|failed`, `--item <id>` and `--evidence <criterion/proof>`. Combine filters with AND. Unknown IDs and invalid options fail before producing JSON. A gap query with zero rows can still contain unmapped requirements; it is not a release approval.

## Configure and observe

`init` prefills conventional inputs only when they actually exist (`src`, `lib`, `test`, `tests`, `bin`, `scripts` and common package/lock files). Review these paths and replace the example acceptance statements. This is an input suggestion, not inferred business coverage.

```sh
proofline doctor --contract target.json --dependencies dependencies.json --json
proofline run AC-01/tests --contract target.json --dependencies dependencies.json -- node --test
proofline query --contract target.json --dependencies dependencies.json --gaps
```

`doctor` checks missing command input scopes, missing paths, direct symbolic links, inclusion of the ledger itself, broken mappings and unmapped requirements. Exit 1 means configuration issues were reported; exit 2 means the invocation or manifest was invalid. It does not run checks or certify the adequacy of a valid mapping. Suggested package scripts come from the actual package file; the suggested runner must be installed locally. Input fingerprints do not follow symbolic links; a link target's contents require their own explicit tracking.

`run` and `capture` accept the same explicit `--contract`/`--dependencies` pair. Their ordinary ledger receipt includes a snapshot of the acceptance/proof configuration and hashes of the declared goal dependencies. No second evidence store is introduced. This binding records what the caller chose to associate; the receipt and a passing exit code do not prove test sufficiency or authenticity of the caller.

Target queries mark otherwise usable observations `stale` if their binding is absent or no longer matches. Failed, missing and declared-only observations keep those states. A change to an unrelated item preserves matching dependency hashes and the prior observation revision remains visible. A new observation against the current target can become `verified` if the ordinary evidence checks also pass. Editing the target under the same revision token does not bypass dependency hash comparison.

## Comparing revisions

`goal-delta --from before.json --to after.json --dependencies dependencies.json --json` compares two explicit snapshots and supports the query filters plus `--affected`. `baseStatus` is the current local evidence state, not an assertion about a historical run. Counts describe the complete delta even for filtered output.

For compatibility, a legacy receipt without a goal binding is treated under the explicitly supplied prior contract: affected usable evidence becomes stale. This is an assumption supplied by the caller. The `query` target-only path is stricter and requires an observation binding. Both policies are named in their machine context. A bound rerun matching the target remains usable in the delta while its historical `impactedBy` link stays visible. When rerunning, include `--contract` and `--dependencies`; an unbound rerun cannot resolve a contract-binding gap.

All five evidence states retain their meaning. `untracked` input metadata is a configuration limitation, not an additional evidence state. Public Workprint output remains a separate, default-deny projection.
