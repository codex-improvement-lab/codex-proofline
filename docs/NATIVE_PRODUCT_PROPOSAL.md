# Native product proposal: Codex Completion Contract

Status: evidence-backed proposal, **not implemented by Proofline**.

## Problem that community code cannot fully solve

Proofline can record local observations after execution. It cannot authoritatively know or attest to all of the following:

- the canonical acceptance criteria agreed across the full task history;
- every tool execution, especially hosted or specialized paths outside local hook coverage;
- whether an Appshot or screenshot originated from the claimed host, simulator, or physical device;
- whether the final assistant response was emitted while required evidence was missing;
- a host-authenticated timestamp or immutable tool receipt.

The official Codex hooks documentation says most local function tools use the hook path, but hosted tools do not and specialized paths can opt out. It also says transcript format is not a stable hook interface. A community Stop hook is therefore a useful guardrail, not a complete native enforcement boundary.

## Proposed capability

Add a task-level **Completion Contract** to Codex with three native primitives.

### 1. Acceptance criteria as first-class task state

Each criterion has a stable ID, text, owner, source turn, required evidence types, freshness rule, and current status. Editing the contract is explicit and visible; the model cannot silently weaken it to complete the task.

### 2. Host-issued evidence receipts

Codex emits structured receipts for eligible observed events:

```json
{
  "criterion_id": "AC-02",
  "evidence_id": "windows-ui",
  "kind": "appshot",
  "source": "codex-host",
  "environment": {
    "surface": "desktop",
    "os": "windows",
    "device_class": "local-machine"
  },
  "observed_at": "2026-08-22T08:56:57.715Z",
  "artifact_digest": "sha256:...",
  "host_receipt": "..."
}
```

The host, not the model, fills observation source and environment class. Sensitive raw output remains redacted or local; the receipt can bind a digest without copying secrets into the conversation.

### 3. Completion gate and export

Before the final response, Codex shows:

- criteria verified by fresh host receipts;
- missing or stale criteria;
- claims without observation;
- explicit user-approved waivers;
- external validation still required.

The user can export the same structured contract to a pull request or release. “Complete” becomes a host-visible state transition rather than a phrase in model prose.

## Boundary and safety requirements

- Never infer a physical device or real user from viewport dimensions, browser emulation, or model text.
- Never store raw secrets merely to make a receipt richer.
- Distinguish model claims, local runtime observations, external service receipts, and user attestations.
- Make waivers explicit, scoped, timestamped, and reversible.
- Do not block emergency work by default; organizations can choose warn, require-review, or enforce policies.
- Preserve offline/local workflows and provide a portable export format.

## Why this belongs natively

Only the host can reliably bind task state, tool events, Appshots, approvals, and final-response lifecycle into one authority boundary. A plugin can guide and warn. It cannot turn partial hook visibility or a mutable local ledger into an authoritative Codex completion state.

## Prototype evidence

Proofline demonstrates that the user-visible model is useful without claiming native authority:

- one graph makes mixed evidence states legible;
- `declared-only` prevents assertions from becoming green;
- freshness and artifact re-hashing expose evidence drift;
- a Stop hook can warn or continue once, but must remain optional and fail open;
- local receipt hashes detect changes but are not signatures.

## Evaluation plan

Run a controlled study across at least 20 real coding tasks:

1. Half use ordinary Codex completion; half use the Completion Contract UI.
2. Independent reviewers judge each acceptance criterion without the transcript.
3. Measure decision time, reviewer agreement, unsupported-green rate, and number of transcript reopenings.
4. Audit every “physical device,” “production,” and “real user” label against its receipt source.

Continue if the contract materially reduces review time and unsupported-green outcomes without causing frequent irrelevant blocks. Stop if users routinely waive the gate, criteria churn makes receipts meaningless, or privacy cost exceeds review value.

## Official evidence

- [Codex hooks and current tool-coverage limits](https://learn.chatgpt.com/docs/hooks)
- [Codex App Server event and approval surface](https://learn.chatgpt.com/docs/app-server)
- [Codex plugin architecture](https://developers.openai.com/plugins/concepts/plugins)

