# A real reported importer question, with an optional Proofline trial

This small probe follows [the maintainer's public response](https://github.com/agentskills/agentskills/discussions/544#discussioncomment-18409986)
about keeping absent counts unknown and distinguishing generation from grading.
It checks two **count** paths in actual Driftproof source. It does not propose a
replacement receipt schema, implement the clock change, or audit the full project.

On upstream commit `871c8c6a82b57934e42a8e4f4b1bcec5f49e08f8` (package 0.11.1):

- `agent-skills-eval` supplies no judge-sample count; the importer writes `1`.
- `skillgrade` supplies two trial rewards and no judge-sample count; the importer
  writes `2` into that count. The two observed rewards should still be retained.
- Both results remain `DECLARED` and use the `external` surface. This control passes.

These are authored minimal inputs run through the real, unmodified importers.
They are not provider runs or independently collected external-user data. The
count assertions implement the rule discussed with the maintainer; the shipped
schema and documentation may still require an older representation.

## Run the independent probe first

Use Node.js 22+ (the upstream requirement) and Git. Starting in a directory for
the two checkouts:

```sh
git clone https://github.com/codex-improvement-lab/codex-proofline.git
git clone https://github.com/driftproofhq/driftproof.git
git -C driftproof checkout 871c8c6a82b57934e42a8e4f4b1bcec5f49e08f8
node codex-proofline/examples/external/driftproof-import-counts/probe.mjs driftproof
```

**Expected exit: 1**, with `agentSkillsEvalJudgeSamples: 1`,
`skillgradeJudgeSamples: 2`, and both count assertions false. The declaration and
reward-preservation checks pass. Exit 2 is a probe/setup error, not this result.
No dependency installation, API key or model invocation is needed for these
library paths. The script does not edit the upstream checkout. The subprocess and
HTTP guards catch accidental provider calls; they are not a security sandbox.

The probe works independently of Proofline. If that is sufficient for the task,
there is no reason to add the optional record below.

## Optional: keep a queryable record through the fix

Continue from the same parent directory. This uses existing Proofline 0.2.0-rc.1
CLI behavior; `--command-only` or an unreleased runtime feature is unnecessary.

```sh
node codex-proofline/examples/external/driftproof-import-counts/prepare.mjs driftproof
node codex-proofline/bin/proofline.js run DECLARED/imports --manifest driftproof/proofline-import-trial.json -- node .proofline/lab-import-trial/probe.mjs . --check declared
node codex-proofline/bin/proofline.js run COUNTS/imports --manifest driftproof/proofline-import-trial.json -- node .proofline/lab-import-trial/probe.mjs . --check counts
node codex-proofline/bin/proofline.js query --manifest driftproof/proofline-import-trial.json --gaps
```

The second observation exits **1 intentionally**; run the final query afterward.
The summary should show one verified line and one failed line. `verified` here
means our local declaration-preservation **check** passed; it does not promote
the imported Driftproof result from `DECLARED` to `TESTED`.

The preparer adds `proofline-import-trial.json` and the private
`.proofline/lab-import-trial/` directory in the selected checkout. It refuses
existing sidecars. It does not replace a pre-existing `proofline.json`, modify
tracked upstream files, install a plugin, or contact a service. Keep the generated
ledger private: command receipts may contain local paths.

After a maintainer changes the import logic or reviewed schema, query again and
rerun relevant checks. Inputs deliberately cover the importer dependencies
conservatively: shared source changes may stale the previously passing control.
An observed failure remains failed until a new observation; it is never silently
upgraded. A passing exit code does not establish that our chosen assertions are a
complete business contract.

## Feedback that would help

Run the standalone probe before deciding whether the optional record earns its
cost. If trying it on a real fix, report the source revision, where setup failed
or needed help, which receipt was useful on the next session, and whether you
would choose this flow again. Additional steps and a preference for plain tests
are useful results. Do not upload private ledgers or production eval data.

Our [maintainer-run observation](../../../docs/evidence/driftproof-import-trial-2026-09-21.json)
is separate from external execution. No independent trial, repeat use, time or
token saving is claimed.
