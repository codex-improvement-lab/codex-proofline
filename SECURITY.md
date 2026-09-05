# Security policy

## Supported versions

Security fixes target the current `main` branch and the `0.1.x` public preview.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/codex-improvement-lab/codex-proofline/security/advisories/new) for sensitive reports. The repository is maintained by [Codex Improvement Lab](https://github.com/codex-improvement-lab), with [Elias S.W.](https://github.com/eliasruntime) as the publishing maintainer.

Do not include secrets, private logs, or exploitable customer data in a public issue.

## Security model

Proofline executes commands only when a user or agent explicitly invokes `proofline run`. It does not discover and run manifest command strings. The manifest describes expected evidence; the actual command follows `--` at invocation time.

The tokenized command is stored in the ledger and appears in reports. Do not place secrets in command-line arguments; pass them through appropriately scoped environment variables or secret stores. Review screenshots for private data before capturing or committing them.

The local server:

- binds to `127.0.0.1` by default;
- exposes only the rendered report, JSON report, and health response;
- sets restrictive content-security and framing headers;
- does not accept writes;
- does not upload evidence.

Plugin lifecycle hooks are non-managed code and require Codex trust review. Review `hooks/hooks.json` and `scripts/proofline-stop.mjs` before enabling them.

The real-Mac release gate temporarily adds and installs a uniquely named local marketplace plugin, runs one read-only ephemeral Codex task with the documented one-shot hook-trust bypass, and then removes both plugin and marketplace. It retains only redacted command summaries. Review [docs/MACOS_HANDOFF.md](docs/MACOS_HANDOFF.md), confirm the account-usage impact, and use the documented recovery commands if the process is interrupted.

Receipt SHA-256 values detect accidental or casual ledger modification. They are not signatures, trusted timestamps, remote attestations, or a defense against an attacker who can rewrite both local records and code.
