# Development workflow

**Status: planned.** This checkout has no app source, package manifest, `pnpm-workspace.yaml`, Cargo manifest, lockfile, or supported scripts. The commands below are intentionally not guessed; do not treat this page as an executable setup guide until implementation adds and verifies those files.

## Intended toolchain

- macOS with the platform prerequisites required by Tauri 2.
- Rust toolchain pinned or documented by the application repository.
- Node.js and the repository-pinned pnpm version.
- Vite frontend and Tauri desktop shell.

The first implementation must publish tested install, development, test, typecheck, and production-build commands in the root README. Keep Rust and frontend verification steps separate where they have separate toolchains.

## pnpm global virtual store and two worktrees

The intended root workspace configuration is:

```yaml
virtualStoreType: global
```

This selects pnpm's global virtual store (not merely its package content store). Each Git worktree keeps its own checkout, lockfile, and `node_modules` links while sharing the machine-wide global virtual store. This is a repository requirement to validate against the pinned pnpm release when manifests are added.

Operational requirements:

1. Install dependencies from the lockfile in each worktree that needs to run the app.
2. Serialize install, store prune, repair, and other maintenance across worktrees. Do not run these concurrently against the shared store.
3. Do not copy `node_modules` between worktrees or check it into Git.
4. After changing branches/lockfiles, reinstall from that worktree's lockfile before relying on linked dependencies.
5. Verify that deleting one worktree does not remove dependencies needed by another, and document the supported cleanup method.

Current pnpm references: [global virtual store](https://pnpm.io/global-virtual-store) and [node_modules settings](https://pnpm.io/settings#virtualstoretype). These links describe pnpm behavior; they do not establish that this repository is configured yet.

## Change workflow

Use focused changes, update implementation status, and run the exact checks documented by the implementation. Git integration checks must use disposable repositories and prove repository state is unchanged. No CI workflow is configured or permitted by project policy.
