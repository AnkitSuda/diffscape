# Development workflow

## Toolchain and commands

Use macOS with Xcode Command Line Tools, Rust/Cargo, Node.js compatible with Vite 7, and pnpm 12.15.0 (pinned in the root `package.json`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm tauri:dev
pnpm build
pnpm lint
pnpm test
pnpm format:check
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri:build
```

`pnpm tauri:build` currently produces the macOS `.app` bundle. DMG bundling is not enabled because Tauri's generated Finder/AppleScript packaging step timed out on the implementation host. No signing or notarization is configured.

## pnpm global virtual store and worktrees

The root workspace opts into `nodeLinker: isolated` and `virtualStoreType: global`. Each Git worktree has its own checkout, lockfile and `node_modules` links while sharing the machine-wide virtual store. Install from each worktree's own checkout:

```sh
pnpm install --frozen-lockfile
```

Serialize installs and store maintenance; do not copy `node_modules` between worktrees. The app implementation has not yet recorded a verified two-independent-worktree install result. After verification, record the pnpm version, store path and that each worktree resolves dependencies successfully here.

## Change and safety workflow

Run frontend and Rust checks separately. Git adapter tests use disposable repositories. Update [status](status.md) with exact evidence and known gaps. No CI workflow is configured or permitted by project policy.
