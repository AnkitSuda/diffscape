# Read-only contract

Read-only is a product requirement. The current adapter is designed around fixed, inspected, read-only Git operations, but the available tests do not yet establish a complete formal guarantee.

## Implemented safeguards

- Git commands are invoked with `Command` argument vectors, never through a shell or generic user-provided command string.
- Optional Git locks, fsmonitor and untracked-cache writes are disabled; inherited `GIT_*` values are removed, prompts and global/system config are disabled.
- Hook path is neutralized, literal pathspecs are forced, pagers suppressed, external diff and textconv disabled.
- Total diff bases are validated as full commit object IDs; paths reject traversal and pathspec magic before being passed after `--`.
- Diff paths are passed after `--`; diff size, file size, output, path count, worktree count and command duration are capped.
- No stage/commit/checkout/ref/config/worktree mutation, fetch, or other network Git command is exposed.
- Real temporary-repository tests compare fixture regular-file bytes and Git index bytes across covered discovery/diff reads, and reject option-like base/path inputs. They do not establish a formal read-only proof.

## Limitations

The integration test compares regular-file byte contents below its temporary fixture root, but does not record file modes or symlink targets and does not comprehensively snapshot administrative state outside that root for linked worktrees. It does not instrument all subprocesses, test hook non-execution, denied permissions, interruption, malformed metadata, invalid UTF-8 names, or concurrent external writes. `GIT_CONFIG_NOSYSTEM` and `GIT_CONFIG_GLOBAL` do not neutralize repository-local configuration, though the executed command set and diff flags are restricted. Do not interpret current tests as a security certification.

Diffscape stores UI preferences locally, can reveal a selected path in Finder, and can launch a validated selected file in a user-configured macOS editor through `open -a` argv. These operations do not intentionally write to the inspected repository. The app has no network service, telemetry or source-content persistence.
