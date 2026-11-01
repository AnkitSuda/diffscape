# ADR 0003: pnpm global virtual store and worktree compatibility

- **Status:** Implemented and sequentially verified on pnpm 12.15.0
- **Date:** 2026-11-01

## Context

The project requires pnpm's global virtual store and must remain usable from two Git worktrees. The global virtual store is shared machine-wide, while each worktree has its own source checkout and dependency links.

## Decision

The root `pnpm-workspace.yaml` configures `nodeLinker: isolated` and the canonical `virtualStoreType: global`; `package.json` pins pnpm 12.15.0. Keep each worktree's own checkout, lockfile, and `node_modules` links, and serialize installs and store maintenance. Two linked worktrees completed sequential frozen-lockfile installs and resolved React/Vite through the same machine-wide store paths.

## Consequences

The shared store makes concurrent install/prune/repair a coordination risk. The observed sequential install test does not establish safety for concurrent installs, store pruning, or every cleanup scenario. Do not confuse the global virtual store with pnpm's package content-addressable store.

## References

- [pnpm global virtual store](https://pnpm.io/global-virtual-store)
- [pnpm `virtualStoreType` setting](https://pnpm.io/settings#virtualstoretype)
