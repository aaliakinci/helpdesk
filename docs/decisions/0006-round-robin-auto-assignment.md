# ADR-0006: Round-robin automatic assignment

Status: Accepted

Date: 2026-08-23

## Context

V1 needs one understandable automatic assignment algorithm. “Least open tickets” introduces dynamic workload semantics and more complex concurrency without being required for the portfolio goal.

## Decision

Use round-robin assignment per queue. A `queue_assignment_state` row stores the cursor/revision. The assignment use case locks that state in a PostgreSQL transaction, selects the next active queue member in deterministic order, advances the cursor, and records assignment history, audit, ticket revision, and outbox data together.

Automatic assignment runs asynchronously after ticket creation. A failed assignment leaves a durable, visible unassigned ticket. Manual assign, unassign, and agent take-over remain separate authorized use cases.

## Consequences

Distribution is simple and deterministic but does not reflect agent skill, availability, or current workload.

## Verification

Pure algorithm tests and parallel real-database tests prove deterministic rotation, inactive-member exclusion, no lost cursor updates, and a single active assignment.

## Revisit when

Measured support operations require workload, skills, schedules, or priority-aware routing.
