---
name: proofline
description: Build or audit an acceptance-to-evidence graph when a user asks whether work is done, release-ready, supported by evidence, suitable for a PR or release report, or still supported after an acceptance contract changes. Use Codex Proofline to connect criteria to observed receipts and trace Goal Delta impact without treating assistant claims or semantic guesses as proof.
---

# Codex Proofline

Use the local `proofline` CLI as the evidence system of record. If `proofline` is not on `PATH` but this skill came from the Codex Proofline plugin, resolve the plugin root two directories above this `SKILL.md` and run `node <plugin-root>/bin/proofline.js`.

For an explicit installation activation self-check, resolve the plugin root from this `SKILL.md`. If `.proofline/macos-activation-contract.json` exists in the workspace, run `node <plugin-root>/scripts/macos-activation.mjs` exactly once; this writes the gate's deterministic, one-time Skill receipt. If a Stop-hook continuation occurs and the receipt already exists, do not run the helper again. Then use the plugin-root fallback to run `version` and `status --json`. Do not edit source or acceptance evidence. Report the observed five-state summary and end every response in this self-check with `PROOFLINE_SKILL_ACTIVE`; never emit the absolute plugin-cache path. The final prose does not need to repeat the installed version because the gate reads it directly from the installed cache and Skill receipt.

## Workflow

1. Find `proofline.json` in the current workspace root. If it does not exist and the user wants a proof graph, run `proofline init` and adapt the generated criteria to the user's actual acceptance contract.
2. Preserve acceptance meaning. Do not weaken, delete, or rewrite a criterion merely to make the graph green.
3. Record a command only by executing it through `proofline run <criterion/proof> -- <command> [...args]`.
4. Record a configured file or screenshot only after it exists with `proofline capture <criterion/proof>`. For screenshots, pass the exact environment label with `--environment` and state whether it was automated, simulated, or from a physical device.
5. When a state is asserted but cannot be observed, use `proofline claim <criterion/proof> --note <boundary>`. A claim must remain `declared-only`.
6. Run `proofline status`, then generate `proofline report --format markdown` for a PR or `--format html` for an inspectable visual graph.
7. Report the five states exactly: `verified`, `missing`, `stale`, `declared-only`, and `failed`.
8. When the user provides prior and target goal/acceptance revisions, require an explicit dependency mapping for every proof line and run `proofline goal-delta --from <prior> --to <target> --dependencies <mapping>`. Do not infer dependencies from prose. Treat `added`, `removed`, `changed`, and `unchanged` as contract verdicts, not evidence states.

## Safety and evidence boundaries

- Do not rerun destructive, billable, publishing, deployment, submission, or account-level commands merely to obtain evidence. Ask for authorization when the underlying action requires it.
- Never infer observed evidence from an assistant message, plan, command string, or file path alone.
- A passing command receipt proves the recorded process outcome, not product correctness beyond that command's scope.
- A screenshot receipt proves the file bytes, timestamp, and declared environment label. It does not independently prove the screenshot came from a physical device, external platform, production system, or real user.
- Do not label macOS verified from Windows execution, CI, or a simulated viewport.
- Keep generated reports reviewable and avoid including secrets or raw command output. Proofline stores hashes and byte counts rather than stdout or stderr contents.
