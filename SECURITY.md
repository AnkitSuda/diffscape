# Security policy

## Supported versions

No signed or supported release versions are published yet. Diffscape is an early functional implementation; security support periods will be stated here when releases exist.

## Reporting a vulnerability

Do not report suspected vulnerabilities in a public issue. Use the repository host's private vulnerability-reporting feature if enabled, or contact a maintainer privately through the repository host. Include the affected revision, impact, and a minimal reproduction when safe. Do not send secrets or private repository contents.

There is no dedicated security response address configured in this repository, so no response-time guarantee is made. Maintainers should publish a verified private contact before the first release.

## Security expectations

- Treat repository contents, Git metadata, paths, and diff text as untrusted input.
- Discovery must not run repository hooks, aliases, or user-controlled scripts.
- The app must not mutate inspected repositories; see [the read-only contract](docs/read-only-contract.md).
- Repository paths and diff contents are sensitive. Do not transmit them to a service; the product has no remote service by design.
- Safety tests are evidence, not a security certification. See [testing gaps](docs/status.md).
