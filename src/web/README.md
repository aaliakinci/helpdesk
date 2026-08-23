# support-web

React and TypeScript web application built with Vite and `@lily_platform/lily_ui`.

The dependency direction is `app -> router -> pages -> features -> shared`. Route pages are thin
feature adapters, cross-feature access uses explicit public entrypoints, and API responses are
decoded at runtime. The public system-status route reads `/api/v1/system/status`.
