export const appMessagesEnUs = {
  brand: "Helpdesk",
  auth: {
    initializing: "Restoring your secure session…",
  },
  login: {
    description: "Sign in with a demo identity. Refresh credentials stay in an HttpOnly cookie.",
    email: "Email",
    emailValidation: "Enter a valid email address.",
    error: "Sign-in failed. Check the credentials or try again later.",
    eyebrow: "Secure access",
    password: "Password",
    passwordValidation: "Enter your password.",
    securityNotice: "Access tokens are held only in memory and refresh tokens rotate after use.",
    submit: "Sign in",
    tenant: "Organization",
    tenantRequired: "Select an organization.",
    title: "Sign in to Helpdesk",
  },
  navigation: {
    signIn: "Sign in",
  },
  session: {
    actionError: "The session action could not be completed.",
    auditor: {
      description: "Your read-only audit boundary is active.",
      eyebrow: "Auditor workspace",
      title: "Audit access ready",
    },
    logout: "Sign out",
    permissions: "Permissions",
    requester: {
      description: "Your requester identity is linked to a customer contact in this organization.",
      eyebrow: "Requester portal",
      title: "Customer access ready",
    },
    revokeAll: "Revoke all sessions",
    role: "Role",
    staff: {
      description: "The server-derived tenant and permission context is active.",
      eyebrow: "Support workspace",
      title: "Staff access ready",
    },
    switchTenant: "Switch organization",
    tenant: "Organization",
  },
  shell: {
    language: "Language",
    skipToContent: "Skip to main content",
  },
  status: {
    api: "Support API",
    checkedAt: "Checked at",
    checking: "Checking services…",
    description:
      "Live readiness from the API, PostgreSQL, RabbitMQ, and Redis infrastructure boundaries.",
    down: "Unavailable",
    eyebrow: "Platform health",
    loadError: "System status could not be loaded. Check the API connection and try again.",
    notReady: "Platform attention required",
    postgresql: "PostgreSQL",
    rabbitmq: "RabbitMQ",
    ready: "Platform ready",
    redis: "Redis",
    retry: "Check again",
    title: "System status",
    traceId: "Trace ID",
    up: "Operational",
    version: "Version",
  },
};

export type AppMessageCatalog = typeof appMessagesEnUs;
