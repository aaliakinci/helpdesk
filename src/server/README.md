# Server boundary

`apps/` contains deployable NestJS composition roots. Business behavior belongs to explicit modules, while database, messaging, observability, storage, and security adapters belong to `platform/`.

The API and worker share module code in-process; this is not a microservice-per-module design.
