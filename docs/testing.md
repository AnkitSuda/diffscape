# Testing strategy

**Status: no test framework or tests exist in this checkout.** Test commands must be added only after manifests and scripts exist; no verification command is currently supported.

## Intended layers

- **Rust unit tests:** path identity, parsing, error mapping, and domain invariants using temporary repositories/filesystems.
- **Git adapter tests:** disposable real repositories; compare before/after state to prove strict read-only behavior for every operation.
- **Bridge contract tests:** validate typed command/event payloads, path scoping, malformed input, and permission/error cases.
- **Frontend tests:** loading/empty/error/partial/stale states, keyboard interaction, and safe rendering of hostile names and diff text.
- **Tauri/macOS checks:** app permissions, file access, window behavior, VoiceOver, signing/distribution assumptions, and supported macOS versions once declared.

## Safety regression matrix

At minimum, cover clean and dirty repositories, staged/unstaged/untracked changes, detached HEAD, linked worktrees, nested paths, spaces and unusual characters, symlinks, inaccessible paths, non-repositories, malformed metadata, and a repository changing concurrently. Record repository state before and after every inspection test. Assert no network activity and no hook/script execution. Tests must never touch a developer's real repository.

## Reporting results

Contributors should list exact commands, platform/tool versions, and outcomes. If a check cannot run (including because tooling is not implemented), say so; do not substitute an unverified command or mark the change fully tested.
