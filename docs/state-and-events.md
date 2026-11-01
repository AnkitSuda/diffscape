# State and events

**Status: proposed model; no state store or event contract exists in this checkout.**

## Ownership

- Rust should own authoritative discovery snapshots and platform/Git observations.
- The frontend should own ephemeral presentation state: selected rows, expanded details, sort/filter criteria, and current view.
- Persistent app preferences, if introduced, should be local, minimal, and distinct from repositories. They must not persist repository content or remote-service credentials.
- Git state is externally mutable. The app's displayed values are timestamped observations, not authoritative locks or promises of freshness.

## Commands and events

The intended interface uses explicit typed requests and responses for actions such as starting an initial scan or refreshing a selected scope. Events may report progress, completion, and per-path failures if implementation needs asynchronous discovery. Event names, payload schemas, cancellation semantics, and ordering are not defined yet.

Any eventual contract should:

- scope results to a scan/request identifier so stale work cannot overwrite a newer snapshot;
- represent partial success and per-item errors explicitly;
- make cancellation and app shutdown safe, without leaving repository changes (there should be none);
- avoid emitting full diffs or sensitive paths to logs by default;
- keep payloads versionable and validate them at the Tauri boundary.

Refresh is observational, not a Git mutation. Avoid claims that event delivery means the underlying repository remains unchanged after the event.
