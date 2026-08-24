# Integration tests

Tests against real PostgreSQL, RabbitMQ, Redis, storage, and process boundaries. The customer and
ticket suite verifies tenant isolation, atomic ticket numbering, write-graph rollback, requester
projection, terminal close/reopen behavior, and optimistic concurrency using the migrated schema.
The queue and assignment suite verifies manager/member boundaries, single-winner ticket revisions,
locked parallel round-robin cursor updates, queue-access policy, transactional history/audit/outbox,
cross-tenant database constraints, and SQL dashboard/workload projections.
