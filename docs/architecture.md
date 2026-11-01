# Architecture

**Status: implemented; early and not release-hardened.** The app uses Tauri 2, a Rust Git adapter, React + TypeScript, Vite, and pnpm.

## Process boundary

```text
React / TypeScript UI
        │ typed purpose-specific invoke/event contracts
        ▼
Tauri 2 bridge (folder picker, notifications, local commands)
        │
        ▼
Rust domain and fixed-argv Git adapter
        │ read-only local filesystem + Git inspection
        ▼
User-selected repository and linked worktree paths
```

The frontend owns selection, filters, language and display state. Rust owns discovery, status parsing, capped diff reads, and filesystem watching. Git invocation uses argument vectors, not a shell. There is no generic shell command endpoint or remote service.

## Current responsibilities and limits

- **Frontend:** three-pane aggregation, worktree selection, status/path filters, lazy diffs, scan timeline, keyboard navigation, English/Hindi labels, local preferences.
- **Tauri:** purpose-specific commands; native directory selection, optional notifications, and Finder reveal.
- **Rust:** NUL-delimited worktree enumeration, status/merge-base parsing, metadata reconciliation and capped diffs. Snapshot commands are observational, not locks.
- **Persistence:** only the selected repository path, language and opt-in notification preference are stored in local browser storage; repository contents are not persisted.

See [status](status.md) for exact validation and outstanding risks. Inaccessible worktrees currently fail a scan rather than returning structured partial results; persistent macOS security-scoped bookmarks and editor launch are not implemented.
