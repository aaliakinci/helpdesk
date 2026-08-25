# Dependency audit

Review date: 25 August 2026

`npm audit` currently reports the high-severity advisory `GHSA-ggr8-5vv4-36mx` through the
development-only chain `prisma -> @prisma/config -> deepmerge-ts`.

The affected merge operation is used by the Prisma CLI configuration layer. Repository Prisma
configuration is trusted source code and is not built from requests, tenant data, uploaded files,
or other untrusted recursive object graphs. The Prisma CLI and its dependencies are not copied into
a production-only runtime image in the release topology.

npm's proposed automatic remediation downgrades Prisma from the qualified `7.9.1` line to `6.12.0`.
That would break the selected Prisma 7 configuration and driver-adapter baseline, so it is not an
acceptable remediation. The exception is temporary: update to the first compatible Prisma patch
that consumes `deepmerge-ts >= 8.0.0`, then repeat generate, migration, integration, image, and
runtime qualification.

Audit findings are not silently suppressed. CI installs from the exact lockfile with lifecycle
scripts disabled and the finding remains visible in install output until an upstream-compatible
fix is qualified.

The CI audit parser permits only this exact advisory chain and fails on any other high or critical
finding. Runtime image scanning separately verifies the installed production filesystem rather
than treating the lockfile classification as runtime reachability evidence. The scanner action is
commit-pinned and installs exact Trivy `v0.74.0`; CI rejects fixable `HIGH` or `CRITICAL` findings in
the support API and worker runtime images.

`@aws-sdk/client-s3@3.1117.0` (Apache-2.0) owns the production S3-compatible storage protocol,
authentication, streaming-body, and abort integration. A small application-owned S3 client would
duplicate signing and protocol security. It is isolated behind the storage port and can be replaced
without changing attachment policy.

`file-type@21.3.4` (MIT) owns bounded signature detection for the attachment allowlist. Filename
extensions and browser-declared media types are not accepted as proof. The application retains its
own UTF-8 plain-text validation and allowlist, so the package does not decide authorization or
storage policy.
