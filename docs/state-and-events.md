# State and events

**Status: implemented with small typed command/event contracts; no formal versioning yet.** Rust produces repository snapshots. React owns presentation, selected worktree/file, filters, diff mode and view layout. Minimal preferences (last repository path, language and notification opt-in) use local storage; contents/diffs are not persisted.

## Commands and events

The frontend uses purpose-specific commands for open/refresh, lazy file diff, watcher start/stop, and path reveal. Rust emits `repository-changed` snapshots after debounced filesystem events or periodic metadata reconciliation. Diff requests carry worktree path/ID, relative path, optional old name, mode and comparison base. Responses include truncation, binary and large-file flags.

The frontend ignores older same-repository snapshots by timestamp and guards diff requests with monotonically increasing request IDs. The watcher uses a bounded event queue, observes at most 64 worktrees and reconciles membership every two seconds; stopping removes the cancellation token and drops observers. Snapshot delivery means only that an observation completed; the underlying repository may change at any time.

Formal schema versioning, per-worktree partial errors, cancellation of in-flight Git subprocesses when a window closes, and automated race/cleanup tests are not implemented.
