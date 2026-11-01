# Repository guidance

Diffscape is an early functional, local-first macOS Git worktree explorer built with Tauri 2, Rust, React, TypeScript, Vite, and pnpm. Consult [`docs/status.md`](docs/status.md) for the observed implementation and known gaps; do not infer release readiness from a feature description.

## Change boundaries

- Keep changes focused and preserve unrelated user or worker changes.
- Never add GitHub Actions workflows. The repository intentionally has no GitHub Actions automation.
- Do not add remote services, accounts, telemetry, analytics, cloud sync, or network-dependent product behavior. Git operations are local-only.
- Do not claim a feature is shipped unless source and verification evidence support it. Keep `docs/status.md` aligned with committed code and mark work-in-progress separately.
- Use pnpm and the committed lockfile; do not substitute npm or Yarn.

## Product safety contract

- Git inspection must remain read-only: do not mutate repositories, worktrees, refs, index, config, remotes, hooks, or working-tree contents.
- Displaying detected changes is not permission to stage, commit, checkout, reset, stash, fetch, pull, push, or otherwise alter a repository.
- Prefer safe, explicit failure to a fallback that could mutate user data. Git integration tests must use disposable repositories and verify inspected state remains unchanged.
- Do not execute untrusted repository hooks, scripts, aliases, or project commands during discovery.

## Package manager and worktrees

- The root `pnpm-workspace.yaml` configures `nodeLinker: isolated` and `virtualStoreType: global`; `package.json` pins pnpm. See [`docs/development.md`](docs/development.md).
- Each Git worktree has its own checkout and `node_modules` links into the machine-wide global virtual store. Installs in two worktrees were verified sequentially; do not run installs or store maintenance concurrently.
- Install from the lockfile in the worktree being used. Do not copy `node_modules` between worktrees.

## Documentation and verification

- Keep setup commands aligned with current manifests and scripts.
- Distinguish committed behavior from local uncommitted work and from proposed design.
- Follow `.editorconfig`; use UTF-8, LF, and a final newline.
- Report exact checks and known gaps; do not present a build, test, or platform as verified unless it was.
