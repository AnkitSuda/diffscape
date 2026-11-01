# Diffscape

Diffscape is a planned read-only macOS app for bringing Git worktrees together in one view. Its intended stack is Tauri 2, Rust, React, TypeScript, Vite, and pnpm.

> **Project status:** early documentation baseline. This checkout currently contains no app source, package manifest, Rust crate, release, or test suite. The product and architecture docs below distinguish design intent from implemented behavior. Do not rely on Diffscape for repository inspection until implementation and safety tests exist.

## Intended principles

- Local-first: inspect repositories and worktrees on the user's Mac.
- Strictly read-only: never alter repository state or invoke mutating Git operations.
- No remote services: no cloud account, sync, telemetry, analytics, or hosted backend is part of the product contract.
- macOS-focused, with native capabilities exposed through a narrow Tauri/Rust boundary.

See [the status page](docs/status.md) for the evidence-based implementation snapshot and [the documentation index](docs/README.md) for the design and development notes.

## Development

There is no supported install, build, or run command in this baseline: the source tree and package manifests are not present. Do not run guessed `pnpm` or Cargo commands. When implementation lands, this section must be replaced with verified prerequisites and commands, including the required pnpm global virtual store and two-worktree guidance.

## Documentation map

- [Architecture](docs/architecture.md) — intended process boundaries and responsibilities
- [Development](docs/development.md) — planned local workflow and worktree package-store policy
- [Git integration](docs/git-integration.md) — safe discovery and data model
- [Read-only contract](docs/read-only-contract.md) — prohibited effects and verification obligations
- [State and events](docs/state-and-events.md) — intended state ownership and event semantics
- [UI and design](docs/ui-and-design.md) — interaction and accessibility principles
- [Internationalization](docs/i18n.md) — localization policy and current state
- [Testing](docs/testing.md) — safety-focused test strategy and current gaps
- [Status](docs/status.md) — implemented vs. intended inventory
- [Architecture decisions](docs/adr/README.md) — concise decisions and proposals

## Contributing and safety reports

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Report vulnerabilities privately using [SECURITY.md](SECURITY.md); do not put exploit details in a public issue.

## License

Distributed under the MIT License. See [LICENSE](LICENSE).
