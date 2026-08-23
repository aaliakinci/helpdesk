# Dependency audit

Review date: 23 August 2026

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
