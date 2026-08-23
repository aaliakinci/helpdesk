# ADR-0011: Repository license

Status: Proposed — repository-owner decision required

Date: 2026-08-23

## Context

The repository is public but currently has no license. Public visibility does not grant reuse rights. A portfolio project benefits from an explicit license, but only the owner can choose those rights.

## Proposed decision

Use the MIT License for the application source, subject to repository-owner approval. Preserve third-party notices and review container/service licenses separately; the application license does not replace their terms.

No `LICENSE` file is added while this ADR remains Proposed.

## Consequences

MIT is simple and portfolio-friendly but allows commercial reuse with minimal conditions. Choosing no license keeps all rights reserved but reduces legitimate reuse and contribution clarity.

## Verification

After owner approval, add the exact license text, set package metadata consistently, and include license/notice checks in release review.

## Revisit when

The owner selects MIT, another license, or an all-rights-reserved policy.
