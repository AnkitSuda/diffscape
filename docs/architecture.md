# Architecture

**Status: implemented; early and not release-hardened.** The app uses Tauri 2, a Rust Git adapter, React + TypeScript, Vite and pnpm.

## Process boundary

```text
React / TypeScript UI
        │ typed purpose-specific invoke/event contracts
        ▼
Tauri 2 bridge (folder picker, native path drop, notifications, local commands)
        │
        ▼
Rust domain and fixed-argv Git adapter
        │ read-only local filesystem + Git inspection
        ▼
User-selected repository and linked worktree paths
```

The frontend owns registered repositories, selection, filters, grouping/sorting, session timeline, language and display preferences. Rust owns repository-root resolution, worktree discovery, status/base parsing, capped lazy diffs, filesystem watching and safe external editor handoff. Git invocation uses argument vectors, not a shell. There is no generic shell endpoint or remote service.

## Current responsibilities and limits

- **Frontend:** native-feeling three-pane aggregation, path/worktree groups, search and change-state filters, sorting, diff modes/layout/context, bounded session activity timeline, English/Hindi labels, local preferences and multi-repository switcher.
- **Tauri:** native folder picker and file/folder drag-drop, opt-in notifications, Finder reveal, validated external editor launch on macOS.
- **Rust:** NUL-delimited worktree enumeration, status/merge-base parsing, metadata reconciliation and capped diffs. Watcher events retain path metadata only, never source contents. Snapshot commands are observational, not locks.
- **Persistence:** registered repository paths, last selected root, per-repo comparison base, language, notification opt-in, editor app, grouping/sort and diff presentation preferences are stored locally. Activity timeline and repository/diff contents are not durably stored.

The editor command passes the selected path as an argv item to macOS `open -a`, not through a shell; editor apps are user-configured. Inaccessible worktrees currently fail a scan rather than returning structured partial results. Persistent security-scoped bookmarks are not implemented. See [status](status.md) for test evidence and remaining risks.
