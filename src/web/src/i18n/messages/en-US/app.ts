export const appMessagesEnUs = {
  brand: "Helpdesk",
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
