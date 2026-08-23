# support-api

NestJS composition root for the versioned REST API, OpenAPI document, authentication adapters, health endpoints, and authorized WebSocket gateway.

Business rules belong to server modules. This application is responsible for transport concerns, dependency composition, process lifecycle, and exposing module use cases without bypassing their authorization or transaction boundaries.
