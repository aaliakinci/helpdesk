import type { AppMessageCatalog } from "../en-US/app";

export const appMessagesTrTr = {
  brand: "Helpdesk",
  auth: {
    initializing: "Güvenli oturumunuz geri yükleniyor…",
  },
  login: {
    description:
      "Demo kimliğiyle giriş yapın. Yenileme bilgisi yalnızca HttpOnly cookie'de tutulur.",
    email: "E-posta",
    emailValidation: "Geçerli bir e-posta adresi girin.",
    error: "Giriş başarısız. Bilgileri kontrol edip yeniden deneyin.",
    eyebrow: "Güvenli erişim",
    password: "Parola",
    passwordValidation: "Parolanızı girin.",
    securityNotice:
      "Erişim anahtarı yalnızca bellekte tutulur ve yenileme anahtarı her kullanımda döndürülür.",
    submit: "Giriş yap",
    tenant: "Organizasyon",
    tenantRequired: "Bir organizasyon seçin.",
    title: "Helpdesk'e giriş yapın",
  },
  navigation: {
    signIn: "Giriş yap",
  },
  session: {
    actionError: "Oturum işlemi tamamlanamadı.",
    auditor: {
      description: "Salt-okunur denetim sınırınız etkin.",
      eyebrow: "Denetçi çalışma alanı",
      title: "Denetim erişimi hazır",
    },
    logout: "Çıkış yap",
    permissions: "İzinler",
    requester: {
      description: "Talep sahibi kimliğiniz bu organizasyondaki müşteri kişisine bağlı.",
      eyebrow: "Talep sahibi portalı",
      title: "Müşteri erişimi hazır",
    },
    revokeAll: "Tüm oturumları iptal et",
    role: "Rol",
    staff: {
      description: "Sunucudan türetilen tenant ve izin bağlamı etkin.",
      eyebrow: "Destek çalışma alanı",
      title: "Ekip erişimi hazır",
    },
    switchTenant: "Organizasyon değiştir",
    tenant: "Organizasyon",
  },
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
