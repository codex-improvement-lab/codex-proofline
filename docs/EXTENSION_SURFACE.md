# Extension-surface decision

Research date: 2026-08-23. Sources are current official OpenAI documentation pages fetched on that date.

## Decision

Proofline v0.1 uses three layers:

1. a dependency-free local CLI and static report as the portable product;
2. a Codex skill for evidence-aware workflow guidance;
3. an optional Codex `Stop` hook for completion-time checking.

It does not require an MCP server, MCP Apps UI, Codex App Server, or Codex SDK.

## Surface review

| Surface | Official role | Proofline decision |
| --- | --- | --- |
| Codex plugin | Packages skills, MCP servers, and optional lifecycle hooks for distribution. | **Use.** A skill plus optional hook makes the CLI discoverable without adding a service. |
| Skill | Provides instructions and resources for a repeatable workflow when existing tools are sufficient. | **Use.** Codex can invoke the local CLI it already has permission to run. |
| Hooks | Run deterministic scripts at lifecycle events including `PostToolUse` and `Stop`; plugin hooks require review and trust. | **Use at `Stop`, optional.** Evaluate the existing graph and warn or continue once. Do not claim complete tool coverage. |
| MCP server | Exposes controlled tools or external-service access through local STDIO or remote HTTP. | **Defer.** Proofline needs local files and process execution, not a hosted data source or model-facing service. |
| MCP Apps UI | Returns optional UI for inspecting, comparing, editing, confirming, or navigating structured information. Tools must remain useful without UI. | **Defer.** The self-contained report already closes the inspection loop. Consider only if an embedded conversational graph becomes a measured need. |
| Codex App Server | Embeds Codex authentication, conversation history, approvals, and streamed agent events into another product. | **Do not use.** Proofline is not a new Codex client and does not need to own the agent loop. |
| Codex SDK / `codex exec` | Automates Codex jobs and CI workflows. | **No product runtime dependency.** The real-Mac release gate invokes one ephemeral `codex exec` task only to verify fresh-session Skill/hook activation. |

## Why this is the smallest complete shape

The user's core loop is local and post-execution:

```text
acceptance contract → observed receipt → freshness/integrity evaluation → PR/release report
```

A CLI gives commands, filesystem access, deterministic exit codes, and CI composition. A self-contained HTML report gives the visual graph without a server after generation. The skill tells Codex when and how to use it. The hook provides a completion seam while remaining inspectable and optional.

Adding MCP in v0.1 would create tool schemas, connection configuration, trust prompts, and possibly a long-running process without unlocking a required behavior. Adding App Server would incorrectly recast Proofline as a Codex client.

## Official sources

- [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins)
- [Build Codex plugins](https://learn.chatgpt.com/docs/build-plugins)
- [Package plugins and lifecycle hooks](https://developers.openai.com/plugins/build/plugins)
- [Codex hooks](https://learn.chatgpt.com/docs/hooks)
- [MCP in Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

## Revisit triggers

Add an MCP server only if independent users repeatedly need a shared or remote evidence store, authenticated external-platform collectors, or model tools that cannot be expressed safely as local CLI calls.

Add MCP Apps UI only if users need to edit or approve proof graphs inside a compatible host and the same workflow remains complete through tool text/structured results alone.

Use App Server only for a distinct product that embeds the full Codex conversation and approval experience. That would be a separate product decision, not a Proofline feature.
