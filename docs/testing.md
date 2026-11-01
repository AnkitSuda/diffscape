# Testing

Current coverage is useful but partial; see [implementation status](status.md) for verified revision and limits.

## Commands

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm exec playwright install chromium # one-time browser setup
pnpm test:e2e
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri:build
```

## Coverage

- Vitest contract tests cover aggregation, unique path vs worktree-file counts, duplicate identities, hierarchical/path grouping, observed activity ordering, and search/status/change-state facets.
- Rust tests create disposable real repositories and linked worktrees. They cover staged, unstaged, untracked and committed changes, rename names, Unicode, binary/large limits, non-default branch/commit bases, invalid base/path/editor requests, prunable worktree metadata, read-only fixture bytes, watcher file activity, linked-worktree addition/removal, metadata-only timeline records and cleanup.
- Playwright Chromium tests exercise the real React UI through a development-only Tauri bridge: repository open/switch/registration, linked-worktree rows, individual duplicate-path selection and diff, live snapshot/timeline updates, filter/group/sort/context preferences, browser drop-path harness, editor preference control, and 800×560 pane visibility. The bridge simulates backend responses; it does not replace Rust integration tests or prove native Tauri event transport.
- `pnpm tauri:build` creates the ARM64 macOS `.app`. Native app launch/accessibility was manually checked; no automated Tauri driver currently launches it.

## Remaining test gaps

Detached/inaccessible-base matrix, malformed or invalid UTF-8 names, symlink and file-mode snapshots, concurrent external mutation, Git subprocess allowlist instrumentation, hook non-execution instrumentation, long-running watcher stress, external editor app launch, native drag/drop UI automation, VoiceOver, reduced-motion/high-contrast checks, and cross-platform builds remain unverified. Never use a developer's real repository as a test fixture.
