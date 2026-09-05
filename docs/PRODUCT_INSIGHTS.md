# Product insights

## Concrete workflow pain

The agent's final message is optimized for narrative closure. Release review is optimized for falsifiability. Between them, the user manually reconstructs:

- what “done” meant;
- which command actually ran;
- whether the artifact changed afterward;
- which screenshot belongs to which acceptance criterion;
- which OS or external platform was observed;
- whether evidence is still fresh;
- which statements are only claims.

This is not primarily a test-execution gap. It is a relationship and provenance gap.

## Product hypothesis

If every acceptance criterion has visible proof edges and a small fixed state vocabulary, a reviewer can decide release readiness without replaying the agent conversation.

The hypothesis is falsified if representative reviewers still need the original chat, raw logs, or a separate checklist for ordinary release decisions after receiving a Proofline report.

## Why a graph, not a checklist

A checklist collapses “required” and “observed” into one checkbox. Proofline separates them:

```text
Acceptance criterion
  ├── command receipt + exit contract + environment + observed time
  ├── artifact receipt + current hash + observed time
  └── screenshot receipt + explicit environment + observed time
```

The graph can expose partial coverage, mixed environments, and different freshness windows without pretending the criterion is a single boolean.

## Five states are the product

| State | Decision rule | User value |
| --- | --- | --- |
| `verified` | Observed, passing, intact, and within freshness. | Safe positive signal with a receipt. |
| `missing` | No usable receipt or artifact exists. | Makes absent work visible. |
| `stale` | Receipt is too old or artifact bytes changed. | Prevents old screenshots and prior builds from silently carrying forward. |
| `declared-only` | A person or agent asserted the state without observation. | Preserves honesty when external validation is pending. |
| `failed` | An observed result violates the acceptance contract or receipt integrity. | Keeps real failures distinct from missing work. |

Removing `declared-only` would force users either to lie with green or lose useful context. Merging `stale` into `failed` would hide the common repair action: re-observe current state.

## Deliberate non-features

- No planning, dependency graph, ownership, scheduling, or agent dispatch. That is execution-before territory.
- No command strings stored in the manifest and auto-executed. The user or agent supplies the actual command at invocation time.
- No raw stdout/stderr retention. Receipts keep hashes and byte counts to reduce accidental secret capture.
- No hosted account, cloud database, or required daemon.
- No claim that a local hash is a trusted attestation.
- No automatic promotion from file existence to evidence. A path alone is not an observation.
- No time-only green for configured command inputs. Source changes invalidate the prior command receipt.

## Differentiation

| Existing surface | What it answers | What Proofline adds |
| --- | --- | --- |
| CI status | Did configured jobs pass? | Which acceptance criterion each result supports, how fresh it is, and what remains outside CI. |
| Test report | Which tests passed or failed? | Files, screenshots, environments, claims, and acceptance-level coverage. |
| Release checklist | Did someone tick the item? | An inspectable receipt and a distinct declared-only state. |
| SBOM/provenance system | What was built and from which inputs? | Reviewer-facing acceptance semantics and visual evidence. |
| Agent final message | What does the agent say happened? | What the local evidence layer can currently verify. |

## Success measures

Measure on real pull requests, not the synthetic demo:

1. Median time from opening the report to identifying the first unsupported criterion.
2. Percentage of acceptance criteria resolvable without reopening the agent transcript.
3. Rate of stale or declared-only evidence caught before release.
4. Reviewer disagreement rate about whether a criterion is supported.
5. False-green rate: reports marked ready that later prove unsupported.

Initial continue criterion: at least five independent release reviews, with at least 80% of criteria decidable from the report and no false-green caused by the evaluator.

Stop or redesign if reviewers consistently treat the graph as duplicate paperwork, cannot define stable acceptance criteria, or need raw telemetry more often than receipt summaries.

## Current evidence

- Automated local tests exercise evidence semantics, ledger tampering, path scope, CLI integration, and report escaping.
- The demo displays verified, missing, stale, declared-only, and failed in one screen.
- Windows desktop and responsive browser layouts were inspected locally.
- Status filtering worked without console errors.

Unknowns remain: independent user comprehension, behavior on a real macOS environment, usefulness on large graphs, and whether teams will maintain explicit acceptance contracts. These require external evidence, not more local implementation.
