# Codex Proofline contributor guide

## Product promise

Codex Proofline turns acceptance criteria into an inspectable graph of local evidence. It is an execution-after proof layer, not a planner, task runner, CI replacement, or attestation authority.

## Evidence rules

- Never promote assistant prose, a planned command, or a declared state to observed evidence.
- Preserve the five public states: `verified`, `missing`, `stale`, `declared-only`, and `failed`.
- A screenshot receipt proves which bytes were captured, when, and under which declared environment label. It does not prove visual correctness, physical-device use, or real-user validation.
- Keep Windows, macOS, preview, automated, physical-device, external-platform, and real-user claims separate.
- Do not label an environment verified unless the relevant check actually ran there.

## Engineering boundaries

- Keep the core dependency-free on Node.js 20+ and compatible by design with Windows and macOS.
- Prefer a complete CLI-to-report loop over additional services or speculative integrations.
- Keep reports deterministic when callers provide a fixed clock.
- Do not add an MCP server or App Server dependency unless a concrete workflow cannot be completed through the CLI, plugin skill, or optional lifecycle hook.
- Run tests and release checks before changing platform or release claims.

