# ADR-0007: Ticket lifecycle, reopen, and auto-close

Status: Accepted

Date: 2026-08-23

## Context

The requirement names statuses but not an executable transition model. Ambiguity would make authorization, SLA, history, concurrency, and UI behavior inconsistent.

## Decision

The v1 transition graph is:

- `New -> Open | Pending | Resolved`
- `Open -> Pending | Resolved`
- `Pending -> Open | Resolved`
- `Resolved -> Open | Closed`
- `Closed` is terminal

Only authorized staff transition ticket status. Every mutation supplies an expected ticket revision; stale changes return a stable `409` conflict. Successful changes update ticket revision and write status history, audit, and outbox in one transaction.

Reopening a Resolved ticket moves it to Open and clears the resolved timestamp under an explicit reopen use case. A Closed ticket is never mutated back to Open; reopen creates a new ticket with `reopened_from_ticket_id` pointing to the Closed source.

Resolved tickets are auto-closed by the worker after a tenant setting whose default is 72 hours. The allowed range is bounded and documented when the setting is implemented.

## Consequences

Closed history stays immutable and stale browser writes cannot silently overwrite newer work. Reopening a Closed issue produces a new ticket number and linked history.

## Verification

State-machine unit tests cover every allowed/forbidden edge. Integration tests protect revision conflicts, transactional history/audit/outbox, linked reopen, and idempotent auto-close.

## Revisit when

A real workflow requires merged tickets, custom statuses, or state-specific automation beyond this fixed graph.
