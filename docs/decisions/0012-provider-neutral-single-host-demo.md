# ADR-0012: Provider-neutral single-host demo

Status: Proposed — provider/domain owner decision required

Date: 2026-08-23

## Context

V1 needs a live HTTPS demo, but cloud provider, domain, region, and monthly budget are not selected. Provider-specific infrastructure now would create cost and lock-in before the application exists.

## Proposed decision

Target a provider-neutral single Linux host running Docker Compose for the portfolio release. Only the HTTPS reverse proxy is public. Web, API, worker, PostgreSQL, RabbitMQ, and Redis use private container networks; state uses explicit volumes/backups. Object storage may be external.

Staging and production use separate secrets, data, volumes, DNS names, and deployment environments. Release images are promoted by immutable digest. Provider, domain, region, backup destination, and budget must be selected before public deployment.

## Consequences

The design is inexpensive and understandable but not a high-availability production topology. A single host is acceptable for a portfolio demo when backups and recovery are proven.

## Verification

Release qualification must prove HTTPS, private service exposure, backup/restore, migration, health/readiness, graceful shutdown, telemetry, deterministic demo reset, and post-deploy smoke tests.

## Revisit when

The owner selects a provider or uptime/scale requirements justify managed data services or orchestration.
