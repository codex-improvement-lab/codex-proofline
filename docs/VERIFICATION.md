# Verification record

The dated record below describes the earlier local candidate. See [the 2026-09-05 publication record](../release/PUBLICATION.md) for the public preview's current source, installed-package, browser and external CI observations. Old package-dry-run wording below is historical; the public preview uses actual local packing and installation, and actual `npm pack --dry-run` in hosted CI.

Date: 2026-08-30

## Environment actually run

- OS: Microsoft Windows 11 Home, Chinese edition
- Version/build: 10.0.26200 / 26200
- Architecture: 64-bit
- Node: v24.19.0 from the bundled Codex workspace runtime
- Browser surfaces: prior Codex in-app browser run against `http://127.0.0.1:4317`; current Codex in-app browser run against a loopback-served, self-contained Goal Delta report

## Checks actually run

- JavaScript syntax checks across `src/`, `bin/`, and `scripts/`.
- Repository lint script.
- Node built-in automated test suite: 42/42 passing.
- Real CLI observations for passing command, current file, stale screenshot, declared-only macOS boundary, failed command, and missing receipt.
- HTML report generation and local HTTP serving.
- Browser DOM inspection of all six acceptance criteria.
- Filter interaction: stale filter reduced visible criteria from six to one; Show all restored six.
- Browser console error/warning check: none observed.
- Desktop viewport screenshot refreshed with a real stored stale gap active in Gap Tour; next/exit controls visible and no page or console errors observed.
- 390×844 responsive check: no horizontal overflow observed.
- Goal Delta CLI generated both self-contained HTML and `workprint-profile/0.1` JSON from two named contract revisions, a complete explicit dependency map, and the evaluated Proofline ledger.
- Three deterministic Goal Delta scenarios: 4/4 green → exactly two dependent lines `stale`; one changed incident target → exactly one line `stale` and three unrelated lines still `verified`; one added plus one removed item → one retired proof and one automatically detected uncovered item.
- Goal Delta browser inspection at 1280×720 and 390×844: opening 4→2 impact hierarchy visible, no horizontal overflow, no warning/error logs, `Trace impact` reached exactly two `PERF-01` proof lines, and `Escape` cleared the trace.
- Plugin manifest validation with the bundled plugin-creator validator.
- Release-file gate: 41 required artifacts, including all three Goal Delta reports/projections, both input schemas, and desktop/mobile/trace visual evidence; package-content dry run included the runtime, candidate descriptor, gate contract/helper, Skill, hook, and handoff and left no tarball.
- Project self-proof report with five locally verified criteria and three explicit external/owner-controlled boundaries.
- Exact regression proving a final assistant message can omit the installed version while direct, candidate-bound Skill and Stop-hook receipts pass; missing token or hook receipt still fails closed.
- Windows-only gate-v2 implementation check with the pinned candidate hash: portable marketplace creation under a spaced path, exact environment rejection, core workflow/report, direct Stop hook, isolated Codex plugin add/list/install/remove, direct installed-cache byte and CLI identity, cache absence after uninstall, and path-redacted JSON output. This is not macOS evidence.
- Official plugin and Skill validators passed after loading PyYAML only into an ignored temporary validation directory, which was removed afterward.
- Live npm registry lookup for `codex-proofline`: 404/not found on 2026-08-22. This indicates no current package record was returned; it does not reserve the name.

## Not run or not yet available

- complete standalone real-Mac gate-v2 execution for current candidate `codex-proofline-macos-rc-7cfd460010f2a95c`;
- real-Mac direct installed-cache identity and deterministic fresh-task Skill/Stop-hook receipts for that replacement candidate;
- physical macOS device flow;
- GitHub Actions on an external runner;
- public plugin installation from a marketplace;
- GitHub pull-request rendering on a remote repository;
- npm publication or install from the public registry;
- real-user or production validation.

The superseded candidate did run on a real Mac and reached fresh-task Skill activation, but failed its old model-version-echo assertion. None of its partial PASS list is promoted to the replacement candidate.

## External targeted Lab result

A user-supplied 2026-08-30 report binds targeted archive `ccfebc7feccc878a…` to prior candidate `codex-proofline-macos-rc-9bdf7995a611f15e`. It reports `PROOFLINE_REPORT.md` present, 34 tests passing, zero failing, one Windows-only test skipped as expected, and the then-current 28-file release gate passing. This remains a bounded historical result for that exact candidate; Goal Delta source changes create a new candidate and do not inherit the prior PASS.

The bounded receipt is [`docs/evidence/lab-targeted-retest-2026-08-30.json`](evidence/lab-targeted-retest-2026-08-30.json). The importer did not directly witness the Darwin run, and the report does not show the standalone installed-cache identity, fresh-task Skill/Stop-hook receipts, or cleanup sequence required by gate v2. Those stronger standalone surfaces remain pending rather than being inferred from the scoped Lab PASS.
