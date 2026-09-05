# macOS replacement-candidate handoff

Status: **current Goal Delta candidate awaits a complete real-Mac run; the prior targeted Lab result remains bound only to its earlier exact candidate.**

The superseded candidate reached its fresh `$proofline` task and returned the Skill activation token, but gate v1 then required the model's final prose to repeat `0.1.0+codex.macos-gate`. The model omitted that optional prose, so the gate stopped before its next assertion. That was a brittle verifier, not an observed Proofline runtime failure.

Gate v2 removes the model-version assertion. It reads the install result's cache path, hashes the installed bytes, directly runs the cached CLI `version` and `status --json`, and then requires separate one-time receipts written by the installed Skill helper and installed `Stop` hook. Missing, stale, or mismatched receipts fail closed. The model still returns a Skill-only activation token, but it never has to repeat the version.

## Frozen replacement candidate

```text
candidate id: codex-proofline-macos-rc-7cfd460010f2a95c
content SHA-256: 7cfd460010f2a95c9f9fa3caa676a28ad985efc1eb48a153f6b72a20eba96329
installed-copy version: 0.1.0+codex.macos-7cfd460010f2a95c
candidate scope: runtime-gate-tests-v1
```

The machine-readable identity is `docs/evidence/macos-replacement-candidate.json`. The content hash covers the runtime, plugin package, Mac gate, automated tests, and Goal Delta source/schema inputs. Gate documentation and generated evidence are outside the hash to avoid self-reference. The earlier `9bdf7995…` targeted Lab result is historical evidence for that exact prior candidate and is not imported here.

Do not copy any `macos-readiness.json`, AC-05 command receipt, or partial PASS list from the superseded candidate. A result is acceptable only when gate v2 recomputes the hash above and completes every check in one new run.

## What one complete run proves

On an actual Darwin host, the gate checks:

1. The checkout matches the pinned replacement-candidate content hash.
2. Node.js 20+ and a Codex CLI with plugin commands are discoverable.
3. The complete Node test suite passes on that host.
4. `sysctl hw.model` returns a Mac hardware model without collecting a serial number.
5. A portable local marketplace is built under a path containing spaces.
6. A mismatched command-evidence environment label is rejected.
7. The bundled CLI executes the spaced-path workflow, status, and self-contained HTML report.
8. `/bin/sh` expands quoted POSIX `PLUGIN_ROOT` and executes the packaged `Stop` hook through `node`.
9. Codex adds the marketplace, discovers the plugin, installs it, and reports it enabled.
10. The gate validates the install JSON identity, directly hashes the reported cached copy, runs that copy's `version`, and evaluates `status --json`.
11. A fresh ephemeral `$proofline` task runs the installed activation helper and receives the installed `Stop` hook. Their independent challenge receipts must match this run and the cached bytes. The disposable workspace permits only those receipt writes; protected manifest, fixture, ledger, and report bytes must remain unchanged.
12. Codex removes the plugin and marketplace and the reported installed-cache directory is absent.
13. The retained JSON contains hashes, byte counts, versions, and booleans—not raw Codex output, usernames, home paths, session IDs, cache paths, or challenge values.

The gate uses `--dangerously-bypass-hook-trust` only for this vetted one-shot automation. Normal plugin use must review and trust the hook with `/hooks`.

## Prerequisites

- A real Mac running macOS.
- Node.js 20 or newer, with `node` and `npm` on `PATH`.
- A current Codex CLI whose `codex plugin --help` command succeeds.
- An authenticated Codex CLI session. The fresh-task check makes one model-backed `codex exec` run and can consume account usage.
- A clean transfer of this exact replacement candidate. Do not use a generated npm archive, because the gate also hashes and runs the test sources.

## Exact real-Mac commands

Run from Terminal. Keep the quotes if the checkout path contains spaces.

```sh
cd "/absolute/path/with spaces/codex-proofline"
node --version
codex --version
npm ci --ignore-scripts
npm test

node ./scripts/macos-readiness.mjs --print-candidate

node ./bin/proofline.js run AC-05/macos-gate \
  --environment "macOS / local host / automated readiness gate" \
  -- npm run macos:gate -- \
    --expected-content-sha256 "7cfd460010f2a95c9f9fa3caa676a28ad985efc1eb48a153f6b72a20eba96329"

node ./bin/proofline.js capture AC-05/macos-evidence \
  --note "Fresh standalone gate-v2 evidence for codex-proofline-macos-rc-7cfd460010f2a95c; prior targeted Lab evidence remains bound to 9bdf7995a611f15e."

node ./bin/proofline.js status
node ./bin/proofline.js report --format markdown --output PROOFLINE_REPORT.md
```

Before running the gate, `--print-candidate` must output exactly the candidate id, full content hash, and installed-copy version shown above. A mismatch means the transfer changed; stop without using old evidence.

## Acceptance gate

Inspect `docs/evidence/macos-readiness.json`. Accept only when all of these are true:

```text
schemaVersion = 2
gateVersion = 2
evidenceClass = real-mac-local-host
candidate.id = codex-proofline-macos-rc-7cfd460010f2a95c
candidate.contentSha256 = 7cfd460010f2a95c9f9fa3caa676a28ad985efc1eb48a153f6b72a20eba96329
candidate.installedVersion = 0.1.0+codex.macos-7cfd460010f2a95c
host.platform = darwin
pathWithSpacesExercised = true
overall = passed
every checks[].status = passed
installed-cache-identity.identityReadDirectly = true
fresh-task-skill-and-hook.skillActivated = true
fresh-task-skill-and-hook.stopHookActivated = true
fresh-task-skill-and-hook.modelVersionEchoRequired = false
fresh-task-skill-and-hook.protectedWorkspaceBytesUnchanged = true
cleanup.pluginRemoved = true
cleanup.marketplaceRemoved = true
cleanup.installedCacheAbsent = true
rawOutputStored = false
```

Then confirm `proofline status` shows both `AC-05/macos-gate` and `AC-05/macos-evidence` as `verified`. Return the new JSON and updated `.proofline/evidence.jsonl` to the original development task. Do not paste raw `codex exec --json` output.

## Status, trust, and recovery

For interactive inspection, use:

```text
codex
/plugins
/hooks
```

Installed plugin capabilities are picked up by a new session, not the session that performed installation. Review the exact hook definition before trusting it.

If the gate is interrupted before cleanup completes, run:

```sh
codex plugin remove codex-proofline@proofline-macos-readiness --json
codex plugin marketplace remove proofline-macos-readiness --json
codex plugin list --json
codex plugin marketplace list --json
```

The last two outputs must not contain `proofline-macos-readiness`. Also verify that the `installedPath` reported by the interrupted install no longer exists; do not remove any broader cache directory.

## Evidence boundary

The future standalone JSON proves a local Darwin process result, a non-secret hardware model, current local plugin lifecycle results, installed-copy identity, and fresh-session activation receipts. The existing targeted Lab report proves only its narrower package acceptance scope. Neither is a signed attestation, GitHub-hosted CI result, production observation, or real-user study.

## Official references

- [Package plugins, local marketplaces, and installed cache](https://developers.openai.com/plugins/build/plugins)
- [Install plugins and start a new session](https://learn.chatgpt.com/docs/plugins)
- [Plugin hook trust, `PLUGIN_ROOT`, and `Stop`](https://learn.chatgpt.com/docs/hooks)
- [`codex exec` JSONL, sandbox, output, and one-shot hook trust bypass](https://learn.chatgpt.com/docs/developer-commands#codex-exec)
