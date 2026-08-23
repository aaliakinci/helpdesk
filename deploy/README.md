# Deployment

Provider-neutral deployment assets for the Helpdesk platform.

`Dockerfile` contains development, build, API, worker, and web targets. The repository-root
`compose.yaml` starts the complete local topology, runs the database migration as a one-shot
service, and gates API, worker, and web startup on dependency health.

The portfolio topology uses a single Docker host with only the HTTPS reverse proxy exposed publicly. Web, API, worker, PostgreSQL, RabbitMQ, and Redis remain on private container networks. Stateful services require explicit volumes, backups, and recovery procedures.
