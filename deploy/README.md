# Deployment

Provider-neutral deployment assets for the Helpdesk platform.

`Dockerfile` contains development, build, API, worker, and web targets. The repository-root
`compose.yaml` starts the complete local topology, runs the database migration as a one-shot
service, prepares the private attachment volume, and gates API, worker, and web startup on those
one-shot and dependency health checks.

`attachment-volume-init` runs as root only long enough to create the Docker named-volume root with
`0700` mode and assign it to the runtime user derived from the image. The init container then exits;
the API itself continues to run as the non-root `node` user. This operation happens inside Docker's
Linux container/volume layer and does not require host-side `chown`, so the same Compose flow works
with Docker Engine on Linux and Docker Desktop on Windows or macOS. A bind-mounted host directory is
not used for attachment bytes.

The portfolio topology uses a single Docker host with only the HTTPS reverse proxy exposed publicly. Web, API, worker, PostgreSQL, RabbitMQ, and Redis remain on private container networks. Stateful services require explicit volumes, backups, and recovery procedures.

The Compose `support-web` target is a local/demo Vite preview server. A public deployment should
publish the built web assets through the hardened HTTPS edge/static host. API and worker release
images are scanned in CI; the final edge/static artifact must be scanned by the deployment pipeline.

API and worker images install only root production dependencies. npm, Corepack, and Yarn are
removed after that build step because the compiled runtime processes do not use package managers.

Production API configuration must explicitly select `ATTACHMENT_STORAGE_DRIVER=s3` (or make an
equally deliberate local-volume decision) and provide the S3-compatible endpoint, region, bucket,
and credentials. Attachment objects are private and must never be exposed directly by the edge.
