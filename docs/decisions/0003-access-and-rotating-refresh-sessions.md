# ADR-0003: Access token and rotating refresh sessions

Status: Accepted

Date: 2026-08-23

## Context

The web application needs short-lived API credentials, revocable sessions, tenant switching, and demonstrable protection against stolen refresh-token reuse.

## Decision

Use a short-lived signed access token held only in web runtime memory. Use an opaque rotating refresh token in a `Secure`, `HttpOnly`, same-origin cookie. Store only a strong hash of the refresh token with session family, membership, expiry, rotation, revocation, and last-use metadata.

Refresh rotation invalidates the prior token. Reuse of an invalidated token revokes the entire session family. Login, refresh, logout, revoke-all, and tenant switch are explicit application use cases.

The server revalidates active session/membership state through PostgreSQL. Redis may cache replaceable session lookups with DB fallback; a cache failure cannot turn a revoked or invalid session into an allowed request. Refresh endpoints validate Origin/same-origin policy and are rate-limited.

## Consequences

The design costs a database-backed session lookup/cache strategy but provides meaningful revoke and role-change behavior. Browser storage never contains refresh credentials.

## Verification

Tests cover rotation, replay/reuse, expiry, logout, revoke-all, disabled user/membership, tenant switch, concurrent 401 recovery, cookie attributes, and trusted Origin behavior.

## Revisit when

The product needs third-party API clients, machine credentials, or identity-provider federation.
