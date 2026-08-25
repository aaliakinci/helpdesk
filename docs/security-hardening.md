# Runtime security controls

## Network and browser boundary

- HTTP CORS accepts only the exact configured `WEB_ORIGIN` and a bounded method/header set.
- Socket.IO handshakes require the same exact origin, a current access token, and a server-derived
  room set. Connection attempts are rate-limited before authentication.
- Express trusts exactly `TRUSTED_PROXY_HOPS` proxy hops (`0..2`). Deployments must set this to the
  actual reverse-proxy topology; arbitrary forwarded addresses are never parsed by application
  middleware.
- General requests and attachment uploads have separate bounded per-client rate buckets. Uploads
  use the lower limit and a bounded request/storage timeout.
- API and web responses set CSP, frame denial, MIME sniffing denial, referrer, permissions, opener,
  and resource-policy headers. Production API responses also set HSTS. The edge proxy must preserve
  these headers and terminate HTTPS.

The in-memory limiter is a per-process protection layer. Multi-instance public deployments should
add an edge or shared distributed limiter for a global quota while retaining this local guard.

## Logging and audit redaction

HTTP completion logs contain method, path without query values, status, duration, and bounded trace
identifiers. Authorization headers, cookies, request/comment bodies, multipart content, filenames,
storage keys, checksums, and connection URLs are not logged. Unexpected errors expose a generic
Problem Details response and log only safe error classifications.

Business audit responses are tenant-scoped, read-only, filtered, and server-paginated. Metadata is
projected through a scalar allowlist; token, secret, cookie, authorization, body, filename,
storage-key, and checksum fields are never returned. Auditors have `audit.read` but no ticket,
membership, queue, SLA, or attachment mutation permission.

## Supply-chain gates

CI installs the exact lockfile with lifecycle scripts disabled, runs the repository's dependency
audit policy, and scans API and worker runtime images for fixable high/critical OS and library
vulnerabilities. Trivy is pinned to an immutable action commit and exact `v0.74.0` scanner release.
The server runtime installs only root production dependencies and removes npm, Corepack, and Yarn
after installation. The Compose web target is a local portfolio/demo preview server, not a promoted
release image; production web assets must be served by the hardened HTTPS edge/static host and
scanned as part of that deployment artifact.

The documented Prisma CLI advisory exception is the only accepted high-severity dependency chain.
Any other high or critical dependency finding fails the audit gate. Unfixed image findings remain
visible but do not block until a remediation exists; fixable high/critical findings block image
promotion.
