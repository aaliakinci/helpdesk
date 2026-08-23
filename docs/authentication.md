# Authentication and tenant security

## Session model

The API issues a signed HMAC-SHA256 access token with a ten-minute default lifetime. The web client
holds it only in runtime memory. Every protected request revalidates the referenced session, user,
membership, and tenant in PostgreSQL, so revocation, disablement, and role changes take effect
without waiting for token expiry.

Refresh credentials are 256-bit opaque random values. Only their SHA-256 lookup hash is stored.
Each successful refresh consumes the current row and creates a new generation in the same family.
Reusing a consumed or revoked generation revokes every still-active generation in that family.

The refresh cookie is `HttpOnly`, `SameSite=Strict`, scoped to `/api/v1/auth`, and `Secure` in the
production environment. Local HTTP development explicitly sets `REFRESH_COOKIE_SECURE=false`.
Refresh and logout require the exact configured web `Origin`.

Passwords use Node.js scrypt with a random 128-bit salt, a 64-byte derived key, `N=32768`, `r=8`,
and `p=1`. Neither passwords, access tokens, refresh values, cookies, authorization headers, nor
request bodies are written to structured logs.

## Tenant and permission boundary

The active tenant comes from an authenticated `tenant_membership`. Free-form tenant headers or body
fields do not select query scope. Tenant-owned membership operations use composite `(tenant_id, id)`
lookups, and foreign-tenant probes return a non-disclosing `404`.

The fixed role catalog is:

| Role      | Current identity capabilities                                                |
| --------- | ---------------------------------------------------------------------------- |
| Owner     | Tenant, membership status/role, ticket, queue, and audit permissions         |
| Manager   | Membership status, ticket, queue, and audit permissions; cannot assign roles |
| Agent     | Ticket and queue operating permissions                                       |
| Requester | Own-ticket read and ticket-create permissions                                |
| Auditor   | Read-only membership, ticket, queue, and audit permissions                   |

Requester memberships must reference a `customer_contact` from the same tenant. PostgreSQL check
and composite foreign-key constraints enforce that relationship independently of API code.

## Local demo identities

The seed creates two organizations and these deterministic emails:

- `owner@demo.helpdesk.test` — Owner in both organizations, exercises tenant selection
- `manager@demo.helpdesk.test`
- `agent@demo.helpdesk.test`
- `requester@demo.helpdesk.test`
- `auditor@demo.helpdesk.test`
- `globex.agent@demo.helpdesk.test`
- `disabled@demo.helpdesk.test` — intentionally rejected

All local demo identities use the password configured by `DEMO_SEED_PASSWORD`. The value in
`.env.example` is public development data and must never be reused in a deployed environment.

## Operational requirements

- Replace `ACCESS_TOKEN_SECRET` with at least 32 cryptographically random bytes before deployment.
- Set `REFRESH_COOKIE_SECURE=true` behind HTTPS.
- Keep `WEB_ORIGIN` exact; do not use wildcard credentialed CORS.
- The current login limiter is process-local. A multi-instance API deployment must replace it with a
  shared bounded store before scaling horizontally.
- Run `npm run smoke:identity` after migration and seed changes.
