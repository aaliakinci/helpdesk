# Integration tests

Tests against real PostgreSQL, RabbitMQ, Redis, storage, and process boundaries. The customer and
ticket suite verifies tenant isolation, atomic ticket numbering, write-graph rollback, requester
projection, terminal close/reopen behavior, and optimistic concurrency using the migrated schema.
