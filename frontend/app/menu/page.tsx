"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import TenantSwitcher from "@/components/tenant/TenantSwitcher";

interface ModuleLink {
  href: string;
  icon: string;
  title: string;
  description: string;
  accent: string;
}

interface QuickAction {
  id: string;
  icon: string;
  title: string;
  description: string;
  accent: string;
  type: "link" | "modal";
  href?: string;
}

export default function MainMenuPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [singleSmsOpen, setSingleSmsOpen] = useState(false);
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);

  const [singleSmsState, setSingleSmsState] = useState({ phone: "", message: "" });
  const [singleSmsLoading, setSingleSmsLoading] = useState(false);
  const [singleSmsFeedback, setSingleSmsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [bulkSmsState, setBulkSmsState] = useState({ recipients: "", message: "" });
  const [bulkSmsLoading, setBulkSmsLoading] = useState(false);
  const [bulkSmsFeedback, setBulkSmsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [bulkSmsSendToAll, setBulkSmsSendToAll] = useState(false);

  const [bulkEmailState, setBulkEmailState] = useState({ recipients: "", subject: "", body: "" });
  const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
  const [bulkEmailFeedback, setBulkEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [bulkEmailSendToAll, setBulkEmailSendToAll] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    // Admin kullanıcısı şube ekranına erişemez
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        if (parsedUser?.role === "PlatformOwner") {
          router.push("/hq/dashboard");
          return;
        }
      } catch {
        // ignore
      }
    }

    api
      .get("/auth/me")
      .then((response) => {
        const userData = response.data;
        // Admin kullanıcısı şube ekranına erişemez
        if (userData?.role === "PlatformOwner") {
          router.push("/hq/dashboard");
          return;
        }
        setAuthorized(true);
        setRole(userData?.role ?? null);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modules = useMemo<ModuleLink[]>(() => {
    const baseModules: ModuleLink[] = [
      {
        href: "/dashboard",
        icon: "🏠",
        title: "Gösterge Paneli",
        description: "Genel sistem özetleri, ders programı ve uyarılar",
        accent: "from-blue-200 to-indigo-200",
      },
      {
        href: "/ai-assistant",
        icon: "🧠",
        title: "Yapay Zekâ Asistanı",
        description: "Haftalık özetleri inceleyin, sorularınıza akıllı yanıtlar alın",
        accent: "from-emerald-200 to-teal-200",
      },
      {
        href: "/documents/expiries",
        icon: "📁",
        title: "Belge Hatırlatmaları",
        description: "Belge bitiş tarihlerini takip et ve otomatik hatırlatma planla",
        accent: "from-teal-200 to-green-200",
      },
      {
        href: "/integrations/mebbis",
        icon: "🛰️",
        title: "MEBBİS Entegrasyonu",
        description: "Mock MEBBİS & e-Devlet işlemlerini yönet",
        accent: "from-cyan-200 to-sky-200",
      },
      {
        href: "/(dashboard)/analytics",
        icon: "📊",
        title: "Analitik Paneli",
        description: "KPI, gelir eğrisi ve doluluk trendlerini inceleyin",
        accent: "from-indigo-200 to-purple-200",
      },
      {
        href: "/students",
        icon: "👥",
        title: "Kursiyer Yönetimi",
        description: "Kursiyer kayıt, arama, evrak ve ödemeleri yönet",
        accent: "from-emerald-200 to-green-200",
      },
      {
        href: "/courses",
        icon: "📚",
        title: "Kurs Yönetimi",
        description: "Kurs oluşturma, takvim, yoklama ve aktarım süreçleri",
        accent: "from-lime-200 to-yellow-200",
      },
      {
        href: "/exams",
        icon: "📝",
        title: "Sınav Yönetimi",
        description: "Sınav planla, sonuç gir ve raporla",
        accent: "from-purple-200 to-pink-200",
      },
      {
        href: "/schedule",
        icon: "📅",
        title: "Ders Programı",
        description: "Haftalık/aylık ders programını planla ve takip et",
        accent: "from-orange-200 to-amber-200",
      },
      {
        href: "/instructors",
        icon: "🧑‍🏫",
        title: "Eğitmenler",
        description: "Eğitmen ekleyin, haftalık planlarını ve ders limitlerini yönetin",
        accent: "from-violet-200 to-purple-200",
      },
      {
        href: "/attendance",
        icon: "✅",
        title: "Yoklama Takibi",
        description: "Yoklama girişlerini ve yoklama raporlarını yönet",
        accent: "from-rose-200 to-red-200",
      },
      {
        href: "/payments",
        icon: "💳",
        title: "Ödeme Yönetimi",
        description: "Ödeme planlarını ve tahsilat süreçlerini yönet",
        accent: "from-teal-200 to-emerald-200",
      },
      {
        href: "/mebbis-transfer",
        icon: "📤",
        title: "MEBBİS Aktarımı",
        description: "Dry run ve canlı MEBBİS aktarım operasyonları",
        accent: "from-yellow-200 to-orange-200",
      },
      {
        href: "/reports",
        icon: "📊",
        title: "Raporlar",
        description: "Yoklama, sınav ve ödeme raporlarını üret",
        accent: "from-slate-200 to-gray-200",
      },
      {
        href: "/notifications",
        icon: "🔔",
        title: "Bildirim Merkezi",
        description: "Sistem uyarıları ve olay bildirimlerini takip et",
        accent: "from-indigo-200 to-violet-200",
      },
    ];

    if (role === "PlatformOwner") {
      return [
        {
          href: "/hq/dashboard",
          icon: "🏢",
          title: "HQ Dashboard",
          description: "Tüm şubelerin performansını izleyin",
          accent: "from-slate-300 to-slate-200",
        },
        {
          href: "/hq/tenants",
          icon: "🗂️",
          title: "Şube Yönetimi",
          description: "Şubeleri yönetin, durumlarını güncelleyin",
          accent: "from-cyan-200 to-blue-200",
        },
        {
          href: "/hq/usage",
          icon: "📈",
          title: "Kullanım Raporları",
          description: "Şube bazlı kullanım raporlarını görüntüleyin",
          accent: "from-emerald-200 to-lime-200",
        },
        {
          href: "/hq/accounts",
          icon: "💰",
          title: "Cari Hesap",
          description: "Gelir ve gider işlemlerini takip edin",
          accent: "from-green-300 to-emerald-300",
        },
        ...baseModules,
      ];
    }

    return baseModules;
  }, [role]);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: "create-student",
        icon: "➕",
        title: "Yeni Kursiyer Kaydı",
        description: "Hızlı kursiyer kayıt formuna git",
        accent: "from-emerald-300 to-green-300",
        type: "link",
        href: "/students?modal=create",
      },
      {
        id: "create-exam",
        icon: "🗓️",
        title: "Sınav Planla",
        description: "Sınav planlama modülünü aç",
        accent: "from-purple-300 to-pink-300",
        type: "link",
        href: "/exams?modal=create",
      },
      {
        id: "generate-report",
        icon: "📄",
        title: "Rapor Oluştur",
        description: "Rapor oluşturma sihirbazını aç",
        accent: "from-blue-300 to-indigo-300",
        type: "link",
        href: "/reports",
      },
      {
        id: "single-sms",
        icon: "📩",
        title: "SMS Gönder",
        description: "Tek kişiye bilgilendirme SMS'i gönder",
        accent: "from-yellow-300 to-amber-300",
        type: "modal",
      },
      {
        id: "bulk-sms",
        icon: "📣",
        title: "Toplu SMS Gönder",
        description: "Birden fazla kişiye toplu SMS gönder",
        accent: "from-orange-300 to-red-300",
        type: "modal",
      },
      {
        id: "bulk-email",
        icon: "✉️",
        title: "Toplu E-Posta Gönder",
        description: "Kursiyerlere bilgilendirme e-postası gönder",
        accent: "from-sky-300 to-cyan-300",
        type: "modal",
      },
    ],
    []
  );

  const handleQuickAction = (action: QuickAction) => {
    if (action.type === "link" && action.href) {
      router.push(action.href);
      return;
    }

    switch (action.id) {
      case "single-sms":
        setSingleSmsFeedback(null);
        setSingleSmsState({ phone: "", message: "" });
        setSingleSmsOpen(true);
        break;
      case "bulk-sms":
        setBulkSmsFeedback(null);
        setBulkSmsState({ recipients: "", message: "" });
        setBulkSmsSendToAll(false);
        setBulkSmsOpen(true);
        break;
      case "bulk-email":
        setBulkEmailFeedback(null);
        setBulkEmailState({ recipients: "", subject: "", body: "" });
        setBulkEmailSendToAll(false);
        setBulkEmailOpen(true);
        break;
      default:
        break;
    }
  };

  const sendSingleSms = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSingleSmsFeedback(null);

    if (!singleSmsState.phone.trim() || !singleSmsState.message.trim()) {
      setSingleSmsFeedback({ type: "error", message: "Telefon numarası ve mesaj zorunludur." });
      return;
    }

    try {
      setSingleSmsLoading(true);
      await api.post("/communications/sms", {
        recipient: singleSmsState.phone.trim(),
        message: singleSmsState.message.trim(),
      });
      setSingleSmsFeedback({ type: "success", message: "SMS başarıyla gönderildi." });
      setSingleSmsState({ phone: "", message: "" });
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "SMS gönderilirken hata oluştu.";
      setSingleSmsFeedback({ type: "error", message });
    } finally {
      setSingleSmsLoading(false);
    }
  };

  const sendBulkSms = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBulkSmsFeedback(null);

    const recipients = bulkSmsState.recipients
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!bulkSmsSendToAll && recipients.length === 0) {
      setBulkSmsFeedback({
        type: "error",
        message: "En az bir telefon numarası girin ya da tüm kursiyerleri seçin.",
      });
      return;
    }

    if (!bulkSmsState.message.trim()) {
      setBulkSmsFeedback({ type: "error", message: "SMS mesaj içeriği gereklidir." });
      return;
    }

    try {
      setBulkSmsLoading(true);
      const response = await api.post("/communications/sms/bulk", {
        sendToAll: bulkSmsSendToAll,
        recipients,
        message: bulkSmsState.message.trim(),
      });

      const count = response.data?.recipientCount;
      const messageText = count
        ? `${count} numaraya SMS gönderildi.`
        : bulkSmsSendToAll
        ? "Sistemdeki tüm kursiyerlere SMS gönderildi."
        : `${recipients.length} numaraya SMS gönderildi.`;

      setBulkSmsFeedback({
        type: "success",
        message: messageText,
      });
      setBulkSmsState({ recipients: "", message: "" });
      setBulkSmsSendToAll(false);
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Toplu SMS gönderiminde hata oluştu.";
      setBulkSmsFeedback({ type: "error", message });
    } finally {
      setBulkSmsLoading(false);
    }
  };

  const sendBulkEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBulkEmailFeedback(null);

    const recipients = bulkEmailState.recipients
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!bulkEmailSendToAll && recipients.length === 0) {
      setBulkEmailFeedback({
        type: "error",
        message: "En az bir e-posta adresi girin ya da tüm kursiyerleri seçin.",
      });
      return;
    }

    if (!bulkEmailState.subject.trim() || !bulkEmailState.body.trim()) {
      setBulkEmailFeedback({ type: "error", message: "E-posta konusu ve içeriği gereklidir." });
      return;
    }

    try {
      setBulkEmailLoading(true);
      const response = await api.post("/communications/email/bulk", {
        sendToAll: bulkEmailSendToAll,
        recipients,
        subject: bulkEmailState.subject.trim(),
        body: bulkEmailState.body.trim(),
      });

      const count = response.data?.recipientCount;
      const messageText = count
        ? `${count} adrese e-posta gönderildi.`
        : bulkEmailSendToAll
        ? "Sistemdeki tüm kursiyerlere e-posta gönderildi."
        : `${recipients.length} adrese e-posta gönderildi.`;

      setBulkEmailFeedback({
        type: "success",
        message: messageText,
      });
      setBulkEmailState({ recipients: "", subject: "", body: "" });
      setBulkEmailSendToAll(false);
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Toplu e-posta gönderiminde hata oluştu.";
      setBulkEmailFeedback({ type: "error", message });
    } finally {
      setBulkEmailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Menü yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
      <nav className="bg-white shadow-lg border-b-2 border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                ← Gösterge Paneli
              </button>
              <TenantSwitcher className="hidden sm:block" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Sistem Menüsü</h1>
            <button
              onClick={() => router.push("/notifications")}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Bildirimler →
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 space-y-10">
          <section className="bg-white shadow-xl rounded-2xl border border-slate-100 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <span className="text-3xl">🗂️</span>
                Ana Modüller
              </h2>
              <span className="text-sm text-slate-500">
                Tüm ana modülleri tek ekrandan erişin
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((module) => (
                <ModuleCard key={module.href} module={module} />
              ))}
            </div>
          </section>

          <section className="bg-white shadow-xl rounded-2xl border border-slate-100 p-6 sm:p-8" id="communications">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Hızlı İşlemler</h2>
                <p className="text-sm text-slate-500">Sık kullanılan aksiyonlara hızlı erişim sağlayın.</p>
              </div>
              <span className="text-sm text-slate-500">
                En sık kullanılan işlemlere tek dokunuşla ulaşın
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickActions.map((action) => (
                <ActionCard key={action.id} action={action} onAction={handleQuickAction} />
              ))}
            </div>
          </section>
        </div>
      </main>

      {singleSmsOpen && (
        <Modal onClose={() => setSingleSmsOpen(false)} title="Tekil SMS Gönder">
          <form className="space-y-4" onSubmit={sendSingleSms}>
            {singleSmsFeedback && (
              <FeedbackAlert type={singleSmsFeedback.type} message={singleSmsFeedback.message} />
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Telefon Numarası</label>
              <input
                type="tel"
                value={singleSmsState.phone}
                onChange={(e) => setSingleSmsState((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+90 5xx xxx xx xx"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mesaj</label>
              <textarea
                value={singleSmsState.message}
                onChange={(e) => setSingleSmsState((prev) => ({ ...prev, message: e.target.value }))}
                rows={4}
                placeholder="Kursiyerlerinize göndermek istediğiniz kısa mesaj içeriği..."
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border-2 border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                onClick={() => setSingleSmsOpen(false)}
              >
                Kapat
              </button>
              <button
                type="submit"
                disabled={singleSmsLoading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {singleSmsLoading ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {bulkSmsOpen && (
        <Modal
          onClose={() => {
            setBulkSmsOpen(false);
            setBulkSmsSendToAll(false);
          }}
          title="Toplu SMS Gönder"
        >
          <form className="space-y-4" onSubmit={sendBulkSms}>
            {bulkSmsFeedback && (
              <FeedbackAlert type={bulkSmsFeedback.type} message={bulkSmsFeedback.message} />
            )}
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={bulkSmsSendToAll}
                  onChange={(e) => setBulkSmsSendToAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                />
                Sistemde kayıtlı tüm kursiyerlere gönder
              </label>
              <p className="text-xs text-slate-500">
                Manuel girilen numaralara ek olarak tüm kursiyerlere SMS gönderilir.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Telefon Numaraları
              </label>
              <textarea
                value={bulkSmsState.recipients}
                onChange={(e) => setBulkSmsState((prev) => ({ ...prev, recipients: e.target.value }))}
                rows={4}
                placeholder="+90 5xx xxx xx xx şeklinde, her satıra bir numara yazın veya virgülle ayırın."
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mesaj</label>
              <textarea
                value={bulkSmsState.message}
                onChange={(e) => setBulkSmsState((prev) => ({ ...prev, message: e.target.value }))}
                rows={4}
                placeholder="Toplu SMS mesaj içeriği..."
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border-2 border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                onClick={() => {
                  setBulkSmsOpen(false);
                  setBulkSmsSendToAll(false);
                }}
              >
                Kapat
              </button>
              <button
                type="submit"
                disabled={bulkSmsLoading}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {bulkSmsLoading ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {bulkEmailOpen && (
        <Modal
          onClose={() => {
            setBulkEmailOpen(false);
            setBulkEmailSendToAll(false);
          }}
          title="Toplu E-Posta Gönder"
        >
          <form className="space-y-4" onSubmit={sendBulkEmail}>
            {bulkEmailFeedback && (
              <FeedbackAlert type={bulkEmailFeedback.type} message={bulkEmailFeedback.message} />
            )}
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={bulkEmailSendToAll}
                  onChange={(e) => setBulkEmailSendToAll(e.target.checked)}
                  className="h-4 w-4 text-sky-600 focus:ring-sky-500 rounded"
                />
                Sistemde kayıtlı tüm kursiyerlere gönder
              </label>
              <p className="text-xs text-slate-500">
                Listeye eklediğiniz adreslere ek olarak tüm kursiyerlere e-posta gönderilir.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-Posta Adresleri
              </label>
              <textarea
                value={bulkEmailState.recipients}
                onChange={(e) =>
                  setBulkEmailState((prev) => ({
                    ...prev,
                    recipients: e.target.value,
                  }))
                }
                rows={4}
                placeholder="Her satıra bir e-posta adresi yazın veya virgülle ayırın."
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Konu</label>
              <input
                type="text"
                value={bulkEmailState.subject}
                onChange={(e) =>
                  setBulkEmailState((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
                placeholder="E-posta konu başlığı"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mesaj</label>
              <textarea
                value={bulkEmailState.body}
                onChange={(e) =>
                  setBulkEmailState((prev) => ({
                    ...prev,
                    body: e.target.value,
                  }))
                }
                rows={6}
                placeholder="E-posta içerik metni..."
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border-2 border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                onClick={() => {
                  setBulkEmailOpen(false);
                  setBulkEmailSendToAll(false);
                }}
              >
                Kapat
              </button>
              <button
                type="submit"
                disabled={bulkEmailLoading}
                className="px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                {bulkEmailLoading ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: ModuleLink }) {
  return (
    <a
      href={module.href}
      className={`group p-6 rounded-xl border-2 border-transparent bg-gradient-to-br ${module.accent} hover:border-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{module.icon}</span>
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-800">{module.title}</h3>
      </div>
      <p className="text-sm text-slate-700 group-hover:text-slate-900">{module.description}</p>
    </a>
  );
}

function ActionCard({ action, onAction }: { action: QuickAction; onAction: (action: QuickAction) => void }) {
  return (
    <button
      onClick={() => onAction(action)}
      className={`w-full text-left p-6 rounded-xl border-2 border-transparent bg-gradient-to-br ${action.accent} hover:border-orange-300 transition-all duration-200 shadow-lg hover:shadow-xl`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{action.icon}</span>
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-800">{action.title}</h3>
      </div>
      <p className="text-sm text-slate-700 group-hover:text-slate-900">{action.description}</p>
    </button>
  );
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FeedbackAlert({ type, message }: { type: "success" | "error"; message: string }) {
  if (type === "success") {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
        {message}
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {message}
    </div>
  );
}


