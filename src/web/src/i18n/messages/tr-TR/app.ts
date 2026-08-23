import type { AppMessageCatalog } from "../en-US/app";

export const appMessagesTrTr = {
  brand: "Helpdesk",
  shell: {
    language: "Dil",
    skipToContent: "Ana içeriğe geç",
  },
  status: {
    api: "Destek API",
    checkedAt: "Kontrol zamanı",
    checking: "Servisler kontrol ediliyor…",
    description:
      "API, PostgreSQL, RabbitMQ ve Redis altyapı sınırlarından alınan canlı hazırlık durumu.",
    down: "Erişilemiyor",
    eyebrow: "Platform sağlığı",
    loadError: "Sistem durumu alınamadı. API bağlantısını kontrol edip yeniden deneyin.",
    notReady: "Platform müdahale bekliyor",
    postgresql: "PostgreSQL",
    rabbitmq: "RabbitMQ",
    ready: "Platform hazır",
    redis: "Redis",
    retry: "Yeniden kontrol et",
    title: "Sistem durumu",
    traceId: "Takip kodu",
    up: "Çalışıyor",
    version: "Sürüm",
  },
} as const satisfies AppMessageCatalog;
