# Release checklist — v0.1.0 public preview

The source freeze is a dated checkpoint. Final external observations and downloadable asset hashes are linked from [the publication record](release/PUBLICATION.md).

## Source and local validation

- [x] Narrow product promise and all five evidence states preserved.
- [x] Dependency-free CLI closes init → observe → evaluate → report.
- [x] Gap Tour initial hiding, Exit and Escape fixed and checked in desktop/narrow browser views.
- [x] Goal Delta covers changed, added, removed and unrelated dependency paths without promoting evidence.
- [x] Synthetic example ledgers and offline reports included in the installable package.
- [x] Source ZIP retains development and standalone Mac gate files.
- [x] README, changelog, MIT license, contribution guide, security reporting URL and release notes prepared.
- [x] Publishing account and Git author resolved to Elias S.W. / `eliasruntime`; organization `codex-improvement-lab`.
- [x] Publication authorized by the owner in this task.
- [x] Official plugin and Skill validators passed locally.
- [x] Core tests, lint, release-file gate and Windows implementation probe checked before tagging.
- [x] Actual package creation and installed CLI/example smoke checked before tagging.
- [x] Private root ledger excluded; historical receipts retained without rewriting their bytes.
- [x] Current content-hash candidate differs from the historical physical-Mac candidate; old PASS is not imported.

## External publication gate

- [ ] Exact source commit passes six hosted Windows/macOS × Node 20/22/24 jobs, including actual npm dry run and installed-package smoke.
- [ ] Tag `v0.1.0` identifies the checked source commit.
- [ ] GitHub prerelease contains source ZIP, installable TGZ and matching SHA-256 sidecars.
- [ ] Publicly downloaded assets match the release hashes.

These external boxes are pending in the pre-publication source snapshot. Their completed evidence is written to the publication record after the platform actions run.

## Explicitly outside this preview's completed claims

The stronger standalone physical-Mac gate-v2 sequence remains pending for the current candidate. No npm registry publication, public plugin-directory installation, production validation or independent real-user study is claimed.
