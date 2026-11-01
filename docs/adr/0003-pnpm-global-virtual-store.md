# ADR 0003: pnpm global virtual store and worktree compatibility

- **Status:** Required policy; repository configuration and compatibility test pending
- **Date:** 2026-11-01

## Context

The project requires pnpm's global virtual store and must remain usable from two Git worktrees. The global virtual store is shared machine-wide, while each worktree has its own source checkout and dependency links.

## Decision

When the pnpm workspace manifest is introduced, configure the canonical setting `virtualStoreType: global`. Keep separate lockfiles per worktree checkout and serialize installs and store maintenance across them. Pin/document the pnpm version and test both worktrees before calling compatibility complete.

## Consequences

The policy can reduce duplicate linking work, but a shared store makes concurrent install/prune/repair a coordination risk. Per-worktree installation and cleanup behavior must be verified. Do not confuse the global virtual store with pnpm's package content-addressable store.

## References

- [pnpm global virtual store](https://pnpm.io/global-virtual-store)
- [pnpm `virtualStoreType` setting](https://pnpm.io/settings#virtualstoretype)
