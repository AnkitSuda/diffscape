# State and events

**Status: implemented with typed command/event contracts; no formal schema versioning yet.** Rust produces repository snapshots. React owns repository/worktree/file selection, filters, grouping/sort, diff mode/layout/context, timeline and local preferences. Local storage records registered/last repositories, per-repository comparison base, language, notification preference, external editor application, grouping/sort, diff layout and context lines. Repository contents and diff bodies are not intentionally persisted.

## Commands and events

Purpose-specific commands open/refresh repositories, request lazy file diffs, start/stop watchers, reveal paths, and hand a validated selected file to a configured macOS editor. Rust emits `repository-changed` snapshots after debounced filesystem events or periodic worktree membership reconciliation. Diff requests carry worktree path/ID, relative path and optional old name, mode, baseline object ID and bounded context lines. Responses include truncation, binary and large-file flags.

Snapshots include at most 100 activity events retained in the active watcher thread: observed timestamp, repository root, worktree identity/label, event kind, and up to 32 relative changed paths per event. They do not contain source snapshots or file contents. The UI merges those events into a session-only list and bounds it to 100. The timeline is not a commit history and is cleared when the app session ends or by the user.

The frontend ignores older same-repository snapshots by timestamp and guards diff requests with request IDs. The watcher uses a bounded 32-notice queue, 350 ms debounce, observes at most 64 worktrees and reconciles membership every two seconds; stop drops observers. Snapshot delivery means only that an observation completed; the repository may change externally at any time.

Formal schema versioning, per-worktree partial errors, and cancellation of in-flight Git subprocesses when a window closes are not implemented.
