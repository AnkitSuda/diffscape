# Contributing to Diffscape

Thanks for helping improve Diffscape. It is an early functional implementation, not yet a signed or release-ready product. Check [implementation status](docs/status.md) and [the read-only contract](docs/read-only-contract.md) before making changes.

## Before you start

- Check existing issues and active work to avoid duplication.
- Discuss substantial product or architecture changes before implementation.
- Keep changes focused and describe user impact, safety implications, and test evidence.
- Do not add GitHub Actions, remote services, telemetry, analytics, or repository-mutating behavior.

## Development

Follow the verified prerequisites and commands in [README](README.md) and [Development](docs/development.md). The package manager is pinned pnpm; the project uses the global virtual store and requires installs from each worktree to be serialized as documented.

## Change expectations

1. Clearly distinguish implemented behavior, committed behavior, local work in progress, and design intent.
2. Preserve the strict read-only Git contract. Any Git integration change must use fixed, reviewed operations and prove target repository state remains unchanged.
3. Add regression tests for behavior. Use disposable repositories for Git tests; never use a developer's real repository as a fixture.
4. Update status and design docs when implementation or verification changes.
5. Include exact automated commands and macOS manual checks; state when checks were not run.
6. Keep user-facing strings translatable and preserve keyboard/accessibility behavior.

## Pull request checklist

- [ ] Scope and implementation status are accurately described.
- [ ] No repository mutation or remote service was introduced.
- [ ] Relevant automated tests and manual checks are listed, or gaps are explicit.
- [ ] Documentation matches committed source and verification evidence.
- [ ] No GitHub Actions workflow or unrelated tooling was added.
