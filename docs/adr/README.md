# Architecture decision records

ADRs are short records of lasting choices. A proposal is not an implemented feature. Supersede an accepted decision with a new ADR rather than silently rewriting history.

| ADR                                                                          | Status                           | Decision                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| [0001 — Local, read-only product boundary](0001-local-read-only-boundary.md) | Accepted product constraint      | Inspect local Git/worktree state only; no repository writes or remote services        |
| [0002 — Tauri and web frontend architecture](0002-tauri-web-architecture.md) | Proposed                         | Tauri 2, Rust, React, TypeScript, Vite, pnpm                                          |
| [0003 — pnpm virtual store and worktrees](0003-pnpm-global-virtual-store.md) | Required; implementation pending | Use a global virtual store and support two worktrees with serialized store operations |
