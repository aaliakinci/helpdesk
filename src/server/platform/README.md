# Server platform

Application-wide technical adapters live here: validated configuration, Prisma/database lifecycle,
RabbitMQ and Redis connections, health aggregation, request context, and structured logging.

Platform code must not own ticketing business rules. Storage and security adapters are added here
only when their product capabilities are implemented.
