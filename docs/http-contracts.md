# HTTP platform contracts

## Request identity

The API accepts bounded, log-safe `x-request-id` and `x-correlation-id` values. Unsafe or missing
request IDs are replaced with a UUID. Both values are returned as response headers. The request ID
is the public `traceId` used by health and error responses.

## Problem Details

HTTP failures use `application/problem+json` with these stable fields:

```json
{
  "type": "https://helpdesk.example/problems/resource.not_found",
  "title": "Not found",
  "status": 404,
  "detail": "The requested resource was not found.",
  "instance": "/missing",
  "code": "resource.not_found",
  "traceId": "request-id"
}
```

Query values are excluded from `instance` and structured logs. Unexpected exceptions return a
generic detail and never expose stack traces, credentials, or exception internals.

## Health and system status

- `GET /health/live` reports only process liveness.
- `GET /health/ready` returns `200` when all mandatory dependencies are up and `503` otherwise.
- `GET /api/v1/system/status` always returns `200` with the current readiness report so the public
  web screen can render individual dependency states.
- `GET /openapi.json` exposes the generated OpenAPI schema; `/openapi` hosts its browser UI.

Readiness checks are named `postgresql`, `rabbitmq`, and `redis`, with `up` or `down` state and
bounded duration metadata. Responses do not include connection URLs or failure exception messages.
