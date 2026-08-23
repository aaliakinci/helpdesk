# Architecture decision records

Decision records are immutable once accepted. A changed decision is documented by a new ADR that supersedes the previous record; accepted files are not rewritten to hide history.

| ADR                                                             | Decision                                        | Status   |
| --------------------------------------------------------------- | ----------------------------------------------- | -------- |
| [0001](0001-shared-schema-tenancy.md)                           | Shared-database/shared-schema tenancy           | Accepted |
| [0002](0002-fixed-v1-roles-and-requester-identity.md)           | Fixed v1 roles and requester identity           | Accepted |
| [0003](0003-access-and-rotating-refresh-sessions.md)            | Access token and rotating refresh sessions      | Accepted |
| [0004](0004-modular-monolith-and-separate-worker.md)            | Modular monolith and separate worker            | Accepted |
| [0005](0005-transactional-outbox-and-at-least-once-delivery.md) | Transactional outbox and at-least-once delivery | Accepted |
| [0006](0006-round-robin-auto-assignment.md)                     | Round-robin automatic assignment                | Accepted |
| [0007](0007-ticket-lifecycle-reopen-and-auto-close.md)          | Ticket lifecycle, reopen, and auto-close        | Accepted |
| [0008](0008-wall-clock-sla.md)                                  | Wall-clock SLA                                  | Accepted |
| [0009](0009-realtime-events-as-invalidation.md)                 | Realtime events as invalidation                 | Accepted |
| [0010](0010-attachment-storage-abstraction.md)                  | Attachment storage abstraction                  | Accepted |
| [0011](0011-repository-license.md)                              | Repository license                              | Proposed |
| [0012](0012-provider-neutral-single-host-demo.md)               | Provider-neutral single-host demo               | Proposed |

Use [the ADR template](template.md) for future decisions.
