# Server modules

Business modules own their domain rules, application use cases, infrastructure adapters, and
presentation boundaries. Direct cross-module persistence access is not allowed.

`identity` owns password verification, signed access tokens, rotating refresh sessions, fixed-role
permissions, active tenant derivation, membership administration, and identity audit entries.
