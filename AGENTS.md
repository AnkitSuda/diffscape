# Repository guidance

Diffscape is intended to be a read-only macOS Git worktree aggregation app. Its planned stack is Tauri 2, Rust, React, TypeScript, Vite, and pnpm. At the initial documentation baseline, this checkout contains no application source, package manifest, Rust manifest, or tests. Treat documentation of planned behavior as a design contract, not proof that it is implemented.

## Change boundaries

- Keep changes narrowly scoped. Do not introduce application behavior, build tooling, dependencies, or generated files as part of a documentation-only change.
- Preserve tracked files unless the task explicitly asks to change them.
- Never add GitHub Actions workflows. The repository intentionally has no GitHub Actions automation.
- Do not add remote services, accounts, telemetry, analytics, cloud sync, or network-dependent product behavior. Git operations are local-only.
- Do not claim a feature is shipped unless source and tests demonstrate it. Update `docs/status.md` when implementation evidence changes.

## Product safety contract

- Git inspection must remain read-only: do not mutate repositories, worktrees, refs, index, config, remotes, hooks, or working-tree contents.
- Displaying detected changes is not permission to stage, commit, checkout, reset, stash, fetch, pull, push, or otherwise alter a repository.
- Prefer safe, explicit failure to a fallback that could mutate user data. Tests for Git integration must use disposable repositories and verify that inspected state remains unchanged.
- Do not execute untrusted repository hooks, scripts, or project commands during discovery.

## Package manager and worktrees

- Use pnpm and commit its lockfile when application manifests are introduced. Do not substitute npm or Yarn.
- The intended pnpm policy is `virtualStoreType: global` in the root `pnpm-workspace.yaml`, subject to confirmation against the pinned pnpm version when implementation lands. This uses pnpm's machine-wide global virtual store; do not confuse it with the package content-addressable store.
- Each Git worktree has its own checkout and `node_modules` links. Do not concurrently run installs or prune/repair the shared global virtual store from different worktrees. Serialize install/maintenance operations; after switching branches or lockfiles, install from that worktree's lockfile and verify its dependencies.
- Keep package-manager version requirements explicit in the manifest once one exists. Do not invent commands before their scripts are present.

## Documentation changes

- Keep README setup instructions executable and aligned with actual manifests/scripts. Where they are not present yet, label them as planned and avoid presenting shell snippets as current commands.
- Prefer short architecture decision records for lasting trade-offs; mark proposals and decisions accurately.
- Follow `.editorconfig`; use UTF-8, LF, and a final newline.
