# Architecture decision records

ADRs are short records of lasting choices. A proposal is not an implemented feature. Supersede an accepted decision with a new ADR rather than silently rewriting history.

| ADR                                                                          | Status                           | Decision                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| [0001 — Local, read-only product boundary](0001-local-read-only-boundary.md) | Accepted product constraint; verification partial | Inspect local Git/worktree state only; no repository writes or remote services |
| [0002 — Tauri and web frontend architecture](0002-tauri-web-architecture.md) | Accepted and implemented | Tauri 2, Rust, React, TypeScript, Vite, pnpm |
| [0003 — pnpm virtual store and worktrees](0003-pnpm-global-virtual-store.md) | Implemented and sequentially verified | Global virtual store and two worktrees with serialized store operations |
