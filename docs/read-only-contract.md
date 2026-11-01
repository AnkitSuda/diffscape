# Read-only contract

**This is a non-negotiable product requirement, not a statement that the current code has been verified.** The baseline contains no Git integration implementation. Any future release must prove this contract before claiming safe repository inspection.

## Allowed intent

Read local repository and worktree metadata to display a user-requested snapshot. Read-only commands may still have incidental effects outside repository state (for example OS process accounting); implementation must minimize them and document any unavoidable local app state.

## Forbidden effects

Diffscape must not alter any target repository's:

- working-tree files or file modes;
- index or lock files;
- refs, `HEAD`, branch state, tags, or object database;
- Git configuration, remotes, hooks, or attributes;
- worktree registration, administrative metadata, or repository-local state.

It must not stage, commit, checkout, switch, reset, clean, stash, merge, rebase, cherry-pick, fetch, pull, push, tag, amend refs, install hooks, or invoke an operation that can do these indirectly. It must not execute repository hooks, aliases, shell startup files, or arbitrary scripts during discovery. No network fetch or service call is allowed.

## User interface implication

Read-only means more than omitting a “Save” button. The app must have no code path or bridge capability that changes repositories. Do not expose ambiguous mutation affordances or describe external changes as app-authored actions. A refresh requests another observation only.

## Required verification before release

For each supported inspection path, tests should capture a disposable repository's refs, index state, worktree file hashes/modes, config, remotes, and worktree metadata before and after the operation and assert equality. Include detached HEAD, linked worktrees, dirty/untracked files, unusual path names, malformed metadata, denied permissions, interruption, and concurrent external changes. Instrument or constrain subprocess arguments so only reviewed read-only commands can run. Add negative tests proving forbidden commands and hooks are never invoked.
