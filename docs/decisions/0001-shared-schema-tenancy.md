# ADR-0001: Shared-database/shared-schema tenancy

Status: Accepted

Date: 2026-08-23

## Context

The portfolio product serves several organizations but does not need database-per-tenant operational complexity. Tenant isolation is nevertheless a critical security property and cannot rely on controller authors remembering a filter.

## Decision

Use one PostgreSQL database and one shared schema. Every tenant-owned table has a non-null `tenant_id`. The active tenant is derived from the authenticated membership on the server, never from a free-form request field or header.

Isolation is enforced at multiple layers:

- application use cases receive an explicit trusted tenant context;
- Prisma queries and writes use tenant-scoped repository methods;
- writes reject entities outside the active tenant;
- composite unique constraints and foreign keys include `tenant_id` where PostgreSQL can enforce same-tenant relationships;
- cross-tenant identifier probes return a non-disclosing `404`;
- integration tests use at least two deterministic tenants for every new resource path.

PostgreSQL row-level security is not part of v1. It may be added only after a focused Prisma transaction/context spike.

## Consequences

Deployment and migrations stay small, but every tenant-owned feature carries explicit isolation work. Raw SQL is exceptional and must include tenant scope plus an integration test.

## Verification

Tenant isolation tests cover list, get-by-id, create, update, delete, nested relationship, search, event audience, and rejected-write side effects against real PostgreSQL.

## Revisit when

Regulatory isolation, tenant-specific restore, or operational scale makes separate schemas/databases materially necessary.
