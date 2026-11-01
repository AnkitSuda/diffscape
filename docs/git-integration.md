# Git integration

**Status: product intent only; no Git adapter exists in this checkout.** The app is intended to aggregate local Git repositories and their worktrees for inspection.

## Discovery goals

The planned adapter should identify a selected repository's common Git directory, working tree(s), branch/ref identity, and a read-only summary of changes. Linked worktrees must be distinguished from independent clones and from ordinary directories. Paths may be missing, inaccessible, malformed, or concurrently changing; surface these as typed per-repository errors rather than silently dropping entries.

Exact command set, supported Git versions, and scan strategy are not yet specified. They must be reviewed against the read-only contract before implementation. Do not shell out through a generic command endpoint; avoid aliases, hooks, and user-controlled startup configuration where possible. Treat names, paths, refs, config values, and command output as untrusted data.

## Identity and consistency

- Canonicalize paths for comparison without assuming case sensitivity or a particular volume layout.
- Avoid using a branch name as a repository or worktree identity; detached HEAD and multiple worktrees can share refs.
- Prefer stable, explicitly scoped identities based on repository/common-dir and worktree paths, while handling symlink and permission cases deliberately.
- Snapshot results are observations, not locks. State can change outside Diffscape at any time; refresh and errors must make this clear.
- Do not write metadata into the repository to track it.

## Prohibited Git operations

No Git integration may stage, commit, checkout/switch, reset, clean, stash, merge, rebase, cherry-pick, fetch, pull, push, tag, update refs, modify config, or run hooks. See [Read-only contract](read-only-contract.md) for the full boundary.
