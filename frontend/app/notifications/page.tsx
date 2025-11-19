"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: "info" | "warning" | "danger" | string;
  createdAt: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  metadata?: Record<string, string>;
}

interface NotificationSummary {
  totalCount: number;
  overduePayments: number;
  failedTransfers: number;
  upcomingExams: number;
}

const severityStyles: Record<string, string> = {
  info: "bg-blue-50 text-blue-700 border border-blue-100",
  warning: "bg-amber-50 text-amber-700 border border-amber-100",
  danger: "bg-red-50 text-red-700 border border-red-100",
};

const categoryLabels: Record<string, string> = {
  all: "Tümü",
  finance: "Finans",
  transfer: "Aktarım",
  exam: "Sınav",
};

const severityLabels: Record<string, string> = {
  all: "Tümü",
  info: "Bilgi",
  warning: "Uyarı",
  danger: "Kritik",
};

export default function NotificationsPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({
    totalCount: 0,
    overduePayments: 0,
    failedTransfers: 0,
    upcomingExams: 0,
  });

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me")
      .then(() => setAuthorized(true))
      .catch(() => router.push("/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (initial: boolean) => {
    if (!authorized) return;

    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        api.get<NotificationSummary>("/notifications/summary"),
        api.get<NotificationItem[]>("/notifications", {
          params: {
            category: categoryFilter === "all" ? undefined : categoryFilter,
            severity: severityFilter === "all" ? undefined : severityFilter,
            limit: 50,
          },
        }),
      ]);

      setSummary(summaryResponse.data);
      setNotifications(listResponse.data || []);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.title ||
        err.message ||
        "Bildirimler yüklenirken bir hata oluştu.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, severityFilter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Bildirimler yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <nav className="bg-white shadow-lg border-b-2 border-blue-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">🔔</span>
                Bildirim Merkezi
              </h1>
            </div>
            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="my-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? "Yenileniyor..." : "Yenile"}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Toplam Bildirim"
              value={summary.totalCount}
              icon="🔔"
              gradient="from-blue-500 to-indigo-600"
            />
            <SummaryCard
              title="Geciken Ödeme"
              value={summary.overduePayments}
              icon="💳"
              gradient="from-amber-500 to-orange-600"
            />
            <SummaryCard
              title="Başarısız Aktarım"
              value={summary.failedTransfers}
              icon="⚠️"
              gradient="from-red-500 to-rose-600"
            />
            <SummaryCard
              title="Yaklaşan Sınav"
              value={summary.upcomingExams}
              icon="🗓️"
              gradient="from-emerald-500 to-green-600"
            />
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Önem Derecesi</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(severityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-gray-500">
                  Filtreler otomatik olarak uygulanır. Daha fazla bildirim için limit 50 olarak ayarlanmıştır.
                </div>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
            {notifications.length === 0 ? (
              <div className="px-6 py-16 text-center text-gray-500">
                Seçilen filtrelere uygun bildirim bulunamadı.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((item) => (
                  <article key={item.id} className="px-6 py-4 hover:bg-blue-50 transition-colors duration-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              severityStyles[item.severity] ?? severityStyles.info
                            }`}
                          >
                            {severityLabels[item.severity as keyof typeof severityLabels] ?? item.severity.toUpperCase()}
                          </span>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {categoryLabels[item.category as keyof typeof categoryLabels] ?? item.category}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                      </div>
                      <div className="text-sm text-gray-500 md:text-right">
                        {new Date(item.createdAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                        {Object.entries(item.metadata).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                            <span className="block text-xs text-gray-500 uppercase">{key}</span>
                            <span className="font-medium text-gray-800 break-words">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  gradient,
}: {
  title: string;
  value: number;
  icon: string;
  gradient: string;
}) {
  return (
    <div className={`rounded-2xl shadow-lg text-white bg-gradient-to-r ${gradient} p-6`}>
      <div className="flex items-center justify-between">
        <div className="text-4xl">{icon}</div>
        <div className="text-3xl font-bold">{value}</div>
      </div>
      <div className="mt-4 text-sm uppercase tracking-wide text-white/80">{title}</div>
    </div>
  );
}

