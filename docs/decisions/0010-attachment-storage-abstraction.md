# ADR-0010: Attachment storage abstraction

Status: Accepted

Date: 2026-08-23

## Context

Development needs simple local storage, while a public deployment must not depend on container-local writable files. Attachment access is tenant- and ticket-sensitive.

## Decision

PostgreSQL stores attachment metadata and ownership; bytes are stored through an application storage port. Development uses a private local-volume adapter. Production uses an S3-compatible/object-storage adapter selected by configuration.

Storage keys are random and never derived from user file names. Uploads enforce size limits, allowlisted/detected media type, checksum, authorization, and private-by-default access. Downloads pass through an authorized API path or a short-lived scoped signed URL. Metadata and bytes have an explicit orphan cleanup/reconciliation policy.

Virus scanning is not claimed in v1 unless a real scanner integration is added and tested.

## Consequences

Production deployment needs object-storage credentials and lifecycle configuration. Local development remains self-contained.

## Verification

Tests cover cross-tenant/unauthorized reads, traversal-resistant keys, size/type rejection, failed transaction/upload cleanup, checksum integrity, and private object access.

## Revisit when

Compliance requires malware scanning, retention locks, customer-managed keys, or regional storage controls.
