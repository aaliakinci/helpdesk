# Attachment storage and security

Ticket attachments are private application resources. PostgreSQL stores authorization metadata;
file bytes are stored behind the `AttachmentStorage` port.

## Storage adapters

- `local` writes to a private mounted directory with `0700` directories and `0600` files. It is
  the default for development and test environments.
- `s3` uses the official AWS SDK S3 client against an explicitly configured S3-compatible
  endpoint, region, bucket, credentials, and path-style setting. Production requires an explicit
  storage driver choice.

Object keys use `<tenant UUID>/<random UUID>` and never contain a user filename. S3 operations and
incoming upload requests have bounded timeouts. Objects and the local volume must not be exposed by
a public static-file server.

Compose prepares the local Docker named volume in a one-shot init container before the API starts.
Only that init process runs as root; it assigns the volume to the image's runtime user and exits.
The API remains non-root and verifies that the local root is readable, writable, and traversable
before listening. This is host-operating-system independent under Docker Desktop because ownership
is managed inside the Docker volume rather than on a Windows or macOS host path.

## Validation and authorization

The application accepts PDF, JPEG, PNG, and UTF-8 plain text up to the configured limit (5 MB by
default and never more than 10 MB). The declared media type must match signature-based detection;
unsupported binary content, mismatches, empty files, and inconsistent byte counts are rejected.
Every stored file has a SHA-256 checksum that is revalidated on download.

Uploads and downloads first resolve the ticket through the caller's server-derived tenant scope.
Requester attachments are always public and may be read only through that requester's own ticket.
Internal attachments require staff ticket-management permission and are omitted from requester
list, detail, realtime audience, and download paths. Closed tickets reject new uploads. Downloads
use an authenticated API response with `private, no-store`, `nosniff`, and attachment disposition.

## Metadata and orphan policy

The byte object is written before the database transaction. A failed metadata/audit/outbox
transaction immediately attempts to delete that object. Cleanup logs include only an error class;
filenames, keys, checksums, bytes, request bodies, and credentials are excluded.

A storage write failure creates no attachment metadata, audit entry, or outbox message. The API logs
only a safe failure classification such as `EACCES` and returns a retryable `503` response.

Operational reconciliation should periodically compare objects older than a grace period with
attachment rows and delete unreferenced objects. A metadata row whose object is missing or whose
checksum fails is an integrity incident and must not be served. Automated scheduled reconciliation
and malware scanning are not included; deployments that require antivirus, retention locks, or
customer-managed encryption keys must add those controls before accepting untrusted public files.

## Backup and recovery

Database and object-store backups form one recovery set. Restore metadata and objects to the same
point-in-time window, then run reconciliation before reopening downloads. The local adapter volume
requires its own backup; rebuilding a container does not recreate attachment bytes.
