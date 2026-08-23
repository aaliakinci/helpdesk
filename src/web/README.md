# support-web

React and TypeScript web application for support staff and requesters.

The dependency direction is `app -> pages -> features -> shared`. Route pages are thin feature adapters, cross-feature access uses explicit public entrypoints, and Lily UI is consumed only through supported package exports.
