# Git integration

**Status: implemented in `src-tauri/src/lib.rs`; early, capped adapter.** The selected directory is resolved through `git worktree list --porcelain -z`, which includes linked paths outside the selected checkout. Worktree IDs are canonical path strings; changed file IDs combine that identity with the relative path so duplicate paths remain separate.

## Discovery and comparison

The adapter reads porcelain status for staged, unstaged and untracked changes, and compares a worktree to a locally available upstream/origin default/main/master merge base. If no candidate exists, a branch may fall back to its parent commit; detached HEAD or missing base is explicitly reported. Committed counts compare base to `HEAD`, while total diff compares base to the current working tree and includes staged/unstaged plus untracked content.

Renames preserve the old path. Binary files are not rendered as text; individual files are capped at 2 MB, diff output at 1.5 MB, Git output at 16 MB, paths at 2,000 per worktree and Git commands at 20 seconds. The scan is limited to 64 worktrees. Names and output are treated as text and paths are passed after Git's `--` separator.

## Safe invocation boundary

The adapter uses fixed Git argument vectors and never invokes a shell. It sets `GIT_OPTIONAL_LOCKS=0`, disables terminal prompts and system/global Git configuration, points hooks to `/dev/null`, disables external diff and textconv, and suppresses pagers. Only local discovery/status/diff/ref-resolution operations are called; there are no fetch/push or repository mutation commands. Temporary-repository tests verify the main index bytes are unchanged across scans and diff reads. This is useful evidence, not a formal proof against all Git/platform behavior.

## Consistency and known gaps

Snapshots are observations that can become stale immediately. A bounded, debounced notify queue watches up to 64 worktrees and reconciles worktree membership/metadata every two seconds. Diff requests are lazy and capped. The app currently returns an error for a scan containing an inaccessible registered worktree rather than partial results. Symlink, unusual invalid-UTF-8 path, malformed Git metadata, command interruption, and full concurrent mutation testing remain outstanding.
