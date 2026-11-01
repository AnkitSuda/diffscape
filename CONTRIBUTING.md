# Contributing to Diffscape

Thanks for helping shape Diffscape. The project is at an early documentation baseline; its planned architecture is not yet evidence of working behavior. Confirm current implementation in [Status](docs/status.md) before building on a proposed interface.

## Before you start

- Check open issues and existing work to avoid duplicating effort.
- For substantial changes, discuss the direction before investing in implementation.
- Keep pull requests focused and describe user impact, safety implications, and test evidence.
- Do not add GitHub Actions, remote services, telemetry, or repository-mutating features.

## Development environment

No application setup commands are currently available because no app manifests or source files are present. Do not infer commands from the planned stack. When implementation exists, follow the verified instructions in the README and [Development](docs/development.md).

The intended package manager is pnpm with a machine-wide global virtual store, and the project must support two Git worktrees. Shared-store installs and maintenance must be serialized; see the documented policy before running package-manager operations.

## Change expectations

1. State whether a change documents intended behavior or implements behavior.
2. Preserve the strict read-only Git contract. Any Git integration change should prove that the target repository is unchanged.
3. Add tests for new behavior and regression cases. Use disposable repositories for Git tests.
4. Update status and design docs when implementation diverges from or fulfills an existing proposal.
5. Include manual verification steps when automated tests cannot exercise macOS behavior.
6. Use `.editorconfig` conventions and keep user-facing text translatable.

## Pull request checklist

- [ ] Scope and implementation status are clearly described.
- [ ] No repository mutation or network service was introduced.
- [ ] Relevant automated tests and manual checks are listed, or the gap is explicit.
- [ ] Documentation and status claims match observed code.
- [ ] No GitHub Actions workflow or unrelated tooling was added.
