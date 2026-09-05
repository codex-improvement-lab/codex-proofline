# Visual evidence provenance

These images are checked-in automated browser evidence, not human or physical-device evidence.

The current publication captures are in [`publication-2026-09-05/`](publication-2026-09-05/). Its `browser-qa.json` records 13 passing interaction checks, four desktop/narrow views without horizontal overflow, observation time, and SHA-256 hashes of five screenshots. It covers initial Gap Tour hiding, stale filtering, G navigation, Exit/Escape hiding, unchanged readiness, and exact Goal Delta dependency tracing. The Windows CUA run used synthetic inputs; the 390×844 viewport is emulation. The older artifacts below retain their original provenance.

| Artifact | Environment | Capture | What it supports |
| --- | --- | --- | --- |
| `proofline-overview.png` | Windows 11 Home build 26200, bundled Playwright Chromium, self-contained report | Viewport screenshot on 2026-08-29 after selecting `Inspect next gap` | Active Gap Tour, status-faithful stale signal, next/exit controls, and five-state toolbar legibility. |
| `proofline-mobile.png` | Same Windows host, automated 390×844 viewport | Viewport screenshot on 2026-08-22 | Responsive stacking and absence of horizontal overflow at that viewport. |
| `goal-delta-desktop.png` | Windows 11 Home build 26200, Codex in-app browser, self-contained Goal Delta report | Automated 1280×720 opening viewport on 2026-08-30; SHA-256 `38e54168db519d71673f1cf2c32a1bfe12318a8fd49d837e40bf05dd8419c867` | The 4→2 all-green-to-stale shock moment, first fault path, prior/target revision identities, and opening summary legibility. |
| `goal-delta-trace.png` | Same Windows host and browser | Automated viewport after selecting `Trace impact`; SHA-256 `e85d62a1994bad8b010f7eb85613a914c079e656c5d09a95af959f32d94cd179` | `PERF-01` reaches exactly `burst-recovery` and `latency-envelope`; unrelated proof lines dim but retain their state. |
| `goal-delta-mobile.png` | Same Windows host and browser, automated 390×844 viewport | Fresh opening viewport on 2026-08-30; SHA-256 `aecb53443e3d8a93ffd60c432f96aa61010cce51d7db3aa84c93aa321dd256d0` | Responsive opening hierarchy, readable 4→2 summary plus exact first fault path, and no horizontal overflow (`scrollWidth` 375 at an `innerWidth` of 390). |
| `../../examples/release-readiness/evidence/product-overview.png` | Same Windows host, automated browser | Viewport screenshot used as a deliberately stale demo receipt | Demonstrates that an existing screenshot can still be stale. |

The earlier browser filter interaction was also exercised: selecting `Stale 1` showed one criterion; selecting `Show all 6` restored all six. The 2026-08-29 automated signature capture raised a real stored stale gap and recorded no page or console errors.

The 2026-08-30 Goal Delta browser run loaded the fixed-clock `checkout-shockwave` report from loopback HTTP. The opening DOM reported four prior verified proof lines, two usable now, two `stale` rows, and one changed contract item. `Trace impact` highlighted exactly two explicitly dependent proof lines; `Escape` cleared the trace. Desktop and mobile runs reported no browser warnings or errors. These observations are local automated UI evidence, not human comprehension, physical-device, real-user, or production evidence.

An attempted full-page browser capture produced stitching artifacts and was rejected. The shipped evidence uses stable viewport captures. This is a screenshot-tool limitation, not proof of an application layout failure.

`macos-replacement-candidate.json` is a source-derived release descriptor, not Mac execution evidence. `macos-readiness.json` must remain absent until the complete pinned candidate runs on a real Mac.

`lab-targeted-retest-2026-08-30.json` records a different and narrower evidence class: an external operator report says the exact `9bdf7995…` candidate passed the five-flagship Lab's targeted Mac acceptance scope with 34 passes, zero failures, one expected Windows-only skip, and a 28/28 release-file gate. That is a scoped physical-Mac Lab PASS, not a substitute for the standalone gate-v2 installed-cache, Skill, Stop-hook, and cleanup sequence.

## Reproduce

```sh
node ./bin/proofline.js report --manifest ./examples/release-readiness/proofline.json --format html --output ./examples/release-readiness/proofline-report.html
node ./scripts/build-goal-delta-examples.mjs
node ./bin/proofline.js goal-delta --manifest ./examples/goal-delta/checkout-shockwave/proofline.json --from ./examples/goal-delta/checkout-shockwave/contracts/before.json --to ./examples/goal-delta/checkout-shockwave/contracts/after.json --dependencies ./examples/goal-delta/checkout-shockwave/dependencies.json --output ./examples/goal-delta/checkout-shockwave/goal-delta-report.html --profile-output ./examples/goal-delta/checkout-shockwave/goal-delta.workprint.json --at 2026-08-30T08:00:00.000Z
```

Open the self-contained report, select **Inspect next gap**, and capture the default desktop viewport. Separately test a 390×844 viewport before changing the mobile artifact. Regenerated images are new automated evidence and should carry a new observation timestamp; do not overwrite provenance silently.
