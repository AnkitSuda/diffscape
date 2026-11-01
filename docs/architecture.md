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

- **Frontend:** three-pane aggregation, worktree selection, status/path filters, lazy diffs, keyboard navigation, English/Hindi labels, and local preferences. A retained path-level activity timeline appears only in an uncommitted implementation diff observed during the audit, not the committed revision.
- **Tauri:** purpose-specific commands; native directory selection, optional notifications, and Finder reveal. An external-editor handoff command appears only in that uncommitted diff.
- **Rust:** NUL-delimited worktree enumeration, status/merge-base parsing, metadata reconciliation and capped diffs. Snapshot commands are observational, not locks.
- **Persistence:** committed UI browser storage includes the last repository path, per-repository comparison bases, language, notification preference, worktree sort, and diff layout. The uncommitted audit-time UI diff additionally stores a registered-repository list, file sort/grouping preferences, and editor application preference; do not treat these as committed until integrated. Diffs and repository file contents are not intentionally persisted.

See [status](status.md) for exact validation and outstanding risks. Inaccessible worktrees currently fail a scan rather than returning structured partial results; persistent macOS security-scoped bookmarks and editor launch are not implemented.
