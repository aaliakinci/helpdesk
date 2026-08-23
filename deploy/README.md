# Deployment

Provider-neutral deployment assets for the Helpdesk platform.

The portfolio topology uses a single Docker host with only the HTTPS reverse proxy exposed publicly. Web, API, worker, PostgreSQL, RabbitMQ, and Redis remain on private container networks. Stateful services require explicit volumes, backups, and recovery procedures.
