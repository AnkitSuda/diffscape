# Architecture

**Status: proposed; not implemented or verified in this checkout.** Intended stack: Tauri 2, Rust backend, React + TypeScript UI, Vite frontend, pnpm package management, macOS target.

## Intended process boundary

```text
React / TypeScript UI
        │ typed, request/response commands and scoped events
        ▼
Tauri 2 bridge (capability allowlist; no generic shell)
        │ narrow internal API
        ▼
Rust domain and Git adapter
        │ read-only local filesystem + Git inspection
        ▼
User-selected repository/worktree paths
```

The diagram expresses a proposed boundary, not an existing module layout. Rust owns filesystem traversal, Git process invocation/parsing, and canonical repository identity. The UI owns presentation, selection, filtering, and transient view state. The bridge should expose purpose-specific operations and typed results; it should not expose arbitrary command execution or raw filesystem access to the webview.

## Responsibilities and constraints

- **Frontend:** render discovered repositories and worktrees, represent loading/error/empty states, and request explicit refreshes. Do not implement repository writes or invoke a remote API.
- **Tauri boundary:** validate arguments, scope permissions to explicitly selected local paths, and return structured errors. Do not grant blanket shell, filesystem, or network capabilities.
- **Rust domain:** normalize identities, inspect Git state without side effects, and report partial failures without hiding them.
- **Git adapter:** use a fixed, audited set of read-only operations; never execute hooks, aliases, or repository scripts.
- **Persistence:** no cloud persistence. Any future local preferences must be separated from user repositories and must not store repository contents by default.

## Dependency direction

UI → typed bridge contract → Rust domain → Git adapter. The Git adapter must not depend on UI state. State/event payloads should use versionable, explicit types rather than serialized implementation internals. Exact module names and schemas remain undecided until implementation exists.

## Open design questions

- How repositories are added and how long path access persists on macOS.
- Which read-only Git commands and minimum Git version are supported.
- Whether and how filesystem watching is implemented; manual refresh is the safe baseline.
- How partial discovery failures and linked worktrees with inaccessible paths are surfaced.
