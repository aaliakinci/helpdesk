# ADR-0008: Wall-clock SLA

Status: Accepted

Date: 2026-08-23

## Context

Business-hours and holiday calendars add a large time-domain feature. The portfolio requirement permits a simpler first version but still needs deterministic first-response and resolution evidence.

## Decision

V1 uses elapsed wall-clock durations by priority from ticket creation. Pending status does not pause either clock. First response completes only on the first public Agent/Manager reply; internal notes and requester comments do not count. Resolution completes when the ticket first enters Resolved.

The ticket retains the applied policy version/snapshot so later policy edits do not rewrite its due instants. Approaching and breached notifications use deterministic deduplication keys.

All due instants are stored as UTC/timestamptz. Tenant time zone affects display, not elapsed calculation.

## Consequences

The SLA is explainable and testable but does not model office hours, holidays, or pending-customer pauses. README and UI must call this limitation out.

## Verification

Unit/integration tests cover priority calculations, exact boundary instants, first public reply, non-counting notes/comments, repeated worker scans, policy changes, and Redis-independent correctness.

## Revisit when

Business-hours calendars become a validated user requirement rather than a portfolio extension.
