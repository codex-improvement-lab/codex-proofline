# First-use observation: Workprint CI maintenance

On 2026-09-12, the Lab maintainer used the **published Proofline 0.2.0-rc.1 CLI**
while reviewing two existing Dependabot pull requests in Workprint:
[checkout #1](https://github.com/codex-improvement-lab/codex-workprint/pull/1)
and [setup-node #2](https://github.com/codex-improvement-lab/codex-workprint/pull/2).
This was actual internal maintenance, not an external-user trial or a replay
of the earlier [14/22-operation study](SIMPLIFICATION_RESULTS_2026-09-09.md).

## Task and evidence

Each PR changes one pinned GitHub Action in the existing workflow. The maintainer
checked the upstream tag/commit, relevant breaking changes, unchanged read-only
permissions, and all four Windows/macOS × Node 22/24 jobs. Each branch was refreshed
against main before verification and merged sequentially. The second refresh
included the first merge. A final check targets the combined main revision.

Proofline wraps a maintainer-authored, read-only GitHub API checker. The checker
requires an explicit target SHA, the expected diff and action pins, four successful
jobs, and successful test/release/build/package steps. Its script and target files
are tracked command inputs. Each PR and the combined result get separate receipts.

| Revision under review | Hosted CI | Result |
| --- | --- | --- |
| Refreshed checkout PR, `db68cfb0d320ffb00d72edec1a0120b7ce40892f` | [34678558827](https://github.com/codex-improvement-lab/codex-workprint/actions/runs/34678558827) | Four jobs passed; PR merged |
| Refreshed setup-node PR, `bd80dc70b8420dcf31d8b2e1f1fee47363641a4c` | [34678715695](https://github.com/codex-improvement-lab/codex-workprint/actions/runs/34678715695) | Four jobs passed; PR merged |
| Combined main, `eeec646c6663fad59805d5ac5e235107f6dd264d` | [34678840844](https://github.com/codex-improvement-lab/codex-workprint/actions/runs/34678840844) | Four jobs passed; only the workflow changed |

The final Proofline query returned three verified receipts and zero gaps. The
[redacted observation record](evidence/maintenance-2026-09-12.json) retains the
selected revisions, receipt hashes and measurement limits.

A command receipt here records **a Windows process reading GitHub-hosted CI
results**. It does not mean Proofline independently ran the remote tests or observed
a physical Mac. The API checker remains private because it uses the maintainer's
local credential helper; no credentials, local paths, raw receipt or command output
are published in this case note.

## First-use friction and resulting change

The released `init` scaffold creates a command criterion and a screenshot criterion.
This task has no visual acceptance condition, so the maintainer had to remove the
screenshot criterion while configuring the actual CI checks.

The **unreleased source checkout** adds one explicit option:

```sh
node ./bin/proofline.js init /path/to/project --command-only
```

It starts with one command criterion and still discovers existing conventional
input paths. Acceptance wording and input associations require review. The default
scaffold continues to include a visual criterion; existing manifests are never
overwritten. Missing evidence starts as missing, a failed command stays failed,
and changed tracked inputs make an old passing receipt stale.

The option is not present in the frozen 0.2.0-rc.1 release archives. CLI regression
and installed-package smoke cover a headless init/run/check loop, a spaced project
path, source invalidation, failed execution, and overwrite refusal.

## What this observation can support

It identifies one irrelevant criterion that needs removal in this class of task. It does not
establish net savings. Manifest customization, explicit target updates, and the
API checker all cost work. GitHub already retains the underlying CI history; the
additional Proofline record needs to earn its maintenance cost on subsequent use.

The observed product path used eight CLI invocations: one version probe, one init,
three recorded API checks, one readiness check, one gaps query and one Markdown
report. The custom checker, manifest customization and target-file writes are
additional work. This invocation count is not the earlier study's operation metric;
the scaffold option does not by itself remove a CLI invocation in this case.

The owner had already inspected notifications and initial PRs before starting the
record. There is no frozen comparison arm, complete task timer, model-usage record,
external-user observation, or repeat-use outcome. The earlier controlled study
remains unchanged. No artificial requirement change was introduced to demonstrate
Goal Delta.
