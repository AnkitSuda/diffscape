# Testing

The repository has runnable frontend and Rust tests. Current coverage is intentionally partial; consult [status](status.md).

## Commands

```sh
pnpm build
pnpm lint
pnpm test
pnpm format:check
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri:build
```

## Existing coverage

- Frontend contract tests verify that identical paths in two worktrees remain distinct worktree-file entries, and that unique-path counts differ from worktree-file counts.
- Rust parser test covers NUL-separated worktree paths, spaces, multiple worktrees and detached records.
- Rust integration test creates a disposable real Git repository and an external linked worktree; it verifies staged, unstaged, untracked and committed counts, a staged rename's old/new names, total diff, Unicode text, binary detection, large-file ceiling, and unchanged main index bytes across scans/diff reads.
- The ARM64 macOS `.app` was built and launched on the implementation host. DMG packaging timed out in Finder's AppleScript and is not configured.

## Outstanding safety and UI matrix

There is no verified automated UI/bridge test suite in the committed app revision. The uncommitted audit-time diff adds a Playwright dependency and a development E2E bridge, but no test spec, script, or execution result was observed; it does not count as verified UI automation. Detached/missing bases, inaccessible or malformed worktrees, symlinks, invalid UTF-8 names, interrupted Git commands, concurrent external mutation, index/ref/config/remotes/modes/admin metadata snapshots, subprocess allowlist instrumentation, hook non-execution, network capture, watcher cleanup stress, VoiceOver, reduced motion, and cross-platform builds still need dedicated verification. Never use a developer's real repository as a test fixture.
