# support-web

React and TypeScript web application built with Vite and `@lily_platform/lily_ui`.

The dependency direction is `app -> router -> pages -> features -> shared`. Route pages are thin
feature adapters, cross-feature access uses explicit public entrypoints, and API responses are
decoded at runtime. The public system-status route reads `/api/v1/system/status`.

The auth feature keeps access credentials only in memory, performs a single-flight cookie refresh,
and exposes role-aware staff, requester, and auditor landing routes. Route guards improve navigation;
the API remains the authorization boundary.

The tickets feature provides runtime-decoded list/detail contracts, requester and staff ticket
creation, public replies, visually distinct internal notes, authoritative status mutations, linked
reopen, and server-side pagination. Requester and staff pages share the feature while preserving
role-specific inputs and projections.
