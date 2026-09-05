# Contributing to Codex Proofline

Proofline's public promise is narrow: connect acceptance criteria to inspectable evidence and make gaps explicit. Contributions should strengthen that loop rather than turn Proofline into a planner, test runner, CI system, or hosted observability platform.

## Local setup

Use Node.js 20 or newer:

```sh
npm install --ignore-scripts
npm run lint
npm test
npm run demo
npm run release:check
```

Before a release, also run:

```sh
npm pack --dry-run
```

For a macOS platform claim, follow [docs/MACOS_HANDOFF.md](docs/MACOS_HANDOFF.md) on a real Mac. `npm run macos:implementation-check` on another platform is useful engineering evidence but never macOS verification.

## Evidence semantics are an API

Changes to `verified`, `missing`, `stale`, `declared-only`, or `failed` require:

1. a concrete workflow that the current semantics cannot express;
2. tests for the prior and proposed behavior;
3. a changelog entry;
4. documentation of any trust-boundary change;
5. backward-compatibility analysis for existing JSONL ledgers and JSON reports.

Never make a graph greener by treating a declaration, planned command, existing path, assistant message, CI configuration, or synthetic viewport as observed evidence.

Goal Delta's `added`, `removed`, `changed`, and `unchanged` values classify contract items; they are not evidence states. Dependency impact must come from an explicit `criterion/proof` → contract-item mapping, never sentence similarity or an assistant inference. An affected observed receipt may become `stale`, while an unrelated proof line must retain the status produced by the normal evaluator.

## Pull requests

Keep changes focused. Include:

- the user-visible problem;
- before/after CLI or report output;
- automated checks that actually ran;
- screenshots when visual behavior changed, with environment provenance;
- platform claims limited to environments that actually ran;
- any remaining external or physical-device work as `declared-only` or `missing`.

Do not include secrets or raw command output in fixtures. Proofline deliberately retains only hashes and byte counts for stdout and stderr, but it does retain the tokenized command. Keep credentials out of command-line arguments and review screenshots for private data.

## Compatibility

Use Node standard-library APIs available in Node 20. Path handling and process execution must work by design on Windows and macOS. A Windows test does not verify macOS; a CI configuration does not verify either platform until the job runs.

## Commit and release identity

Do not invent author, maintainer, repository, homepage, signing, or package-publisher identity. These are filled only after the project owner confirms them.
