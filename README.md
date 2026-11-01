# Diffscape

Diffscape is a local, read-only macOS desktop app for comparing Git worktrees in one place. It aggregates changed relative paths while keeping each worktree's copy distinct, and provides working, staged, and merge-base total diffs.

**Status:** early functional implementation. The ARM64 macOS `.app` builds and launches on the implementation host. Safety and integration tests cover a useful core but not the full release matrix; see [implementation status](docs/status.md) before relying on it for sensitive repositories.

## Product principles

- Local-first inspection, no hosted backend, analytics, or telemetry.
- Read-only Git operations; no stage, commit, checkout, ref/config mutation, or network access.
- Worktree-file identity is distinct from a shared relative path; overlap is never labeled a merge conflict.
- Native folder picker, optional opt-in notifications, English/Hindi UI, and lazy/capped diffs.

## Development

Prerequisites: macOS with Xcode Command Line Tools, Rust/Cargo, Node.js compatible with Vite 7, and pnpm 12.15.0 (`packageManager` is pinned).

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Vite frontend only
pnpm tauri:dev           # native app in development
pnpm build               # TypeScript + Vite production frontend
pnpm lint
pnpm test
pnpm format:check
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri:build         # ARM64/macOS .app bundle
```

The project sets `nodeLinker: isolated` and `virtualStoreType: global` in `pnpm-workspace.yaml`. Each linked worktree needs its own frozen install; installations share pnpm's machine-wide global virtual store. Do not run store cleanup concurrently with installs. The two-worktree install scenario is still to be verified; see [development](docs/development.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Git integration](docs/git-integration.md)
- [Read-only contract](docs/read-only-contract.md)
- [State and events](docs/state-and-events.md)
- [UI and design](docs/ui-and-design.md)
- [Internationalization](docs/i18n.md)
- [Testing](docs/testing.md)
- [Status](docs/status.md)
- [Architecture decisions](docs/adr/README.md)

No GitHub Actions, publication, or release signing is configured.
