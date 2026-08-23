# Prisma

Owns the Prisma schema, PostgreSQL migrations, seed infrastructure, and database qualification assets. PostgreSQL is the business source of truth.

Migrations must preserve tenant isolation, same-tenant relationships, durable outbox data, and safe forward deployment.
