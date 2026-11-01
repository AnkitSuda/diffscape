# Security policy

## Supported versions

No released or supported application versions are currently published. The repository is at an early documentation baseline; security support periods will be stated here when releases exist.

## Reporting a vulnerability

Please do not report suspected vulnerabilities in a public issue. Use the hosting provider's private vulnerability-reporting feature if it is enabled, or contact a project maintainer privately through the repository host. Include the affected revision, impact, and a minimal reproduction when safe. Avoid sending secrets or personal repository contents.

There is no dedicated security response address configured in this baseline, so no response-time guarantee is made. Maintainers should add a verified private contact before the first public release.

## Security expectations

- Repository contents and Git metadata are untrusted input.
- Git discovery must not run hooks, aliases, or user-controlled scripts.
- The app must not mutate a user's repository; see [the read-only contract](docs/read-only-contract.md).
- Local repository paths and diff contents are sensitive. Do not transmit them to a service; the product has no remote service by design.
- Security fixes must include regression coverage where practical and must not weaken the read-only boundary.
