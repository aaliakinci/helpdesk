# Server modules

Business modules own their domain rules, application use cases, infrastructure adapters, and
presentation boundaries. Direct cross-module persistence access is not allowed.

`identity` owns password verification, signed access tokens, rotating refresh sessions, fixed-role
permissions, active tenant derivation, membership administration, and identity audit entries.

`support` owns customer/contact aggregates, customer history, tenant ticket numbering, ticket state
transitions, optimistic revisions, role-specific ticket projections, comments, status history,
business audit entries, and durable outbox writes. Customer, ticket command, and ticket query
providers remain separate so HTTP controllers do not become business-logic boundaries.
