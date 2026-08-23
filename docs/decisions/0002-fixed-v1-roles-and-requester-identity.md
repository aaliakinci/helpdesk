# ADR-0002: Fixed v1 roles and requester identity

Status: Accepted

Date: 2026-08-23

## Context

The product needs clear authorization evidence, while a custom role builder would add a second permissions product before ticketing is complete. Requester login must also map unambiguously to a tenant customer/contact.

## Decision

V1 uses five fixed roles with a versioned permission catalog in code:

- Owner
- Manager
- Agent
- Requester
- Auditor

Owners assign roles to memberships but cannot define new roles or permissions in v1.

`users` is the global login identity. Access to a tenant exists only through `tenant_memberships`. A Requester membership must link to one `customer_contact` in the same tenant. Tickets store the requester contact; requester authorization follows that server-side relationship and does not trust a supplied customer identifier.

## Consequences

Authorization behavior is deterministic and testable. Organizations needing custom roles must wait for a later release and migration path.

## Verification

A permission matrix test protects every controller/use case. Integration tests prove Requester ownership, Auditor read-only behavior, Agent queue access, and Owner/Manager administration boundaries.

## Revisit when

Two real target users require different permissions within the same fixed role and the need cannot be represented by queue membership or resource ownership.
