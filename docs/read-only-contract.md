# Read-only contract

Read-only is a product requirement. The current adapter is designed around fixed, inspected, read-only Git operations, but the available tests do not yet establish a complete formal guarantee.

## Implemented safeguards

- Git commands are invoked with `Command` argument vectors, never through a shell or generic user-provided command string.
- Optional Git locks are disabled; prompts and global/system config are disabled.
- Hook path is neutralized, pagers suppressed, external diff and textconv disabled.
- Diff paths are passed after `--`; diff size, file size, output, path count, worktree count and command duration are capped.
- No stage/commit/checkout/ref/config/worktree mutation, fetch, or other network Git command is exposed.
- A real temporary-repository test confirms Git index bytes remain unchanged across discovery and diff reads.

## Limitations

The integration test does not yet snapshot every ref/config/remotes/file mode/worktree administrative record before and after. It does not instrument all subprocesses, test hook non-execution, denied permissions, interruption, malformed metadata, invalid UTF-8 names, or concurrent external writes. `GIT_CONFIG_NOSYSTEM` and `GIT_CONFIG_GLOBAL` do not neutralize repository-local configuration, though the executed command set and diff flags are restricted. Do not interpret current tests as a security certification.

Diffscape stores minimal preferences in local app storage and can open a selected path in Finder. Neither operation writes to the inspected repository. There is no network service, telemetry or repository-content persistence.
