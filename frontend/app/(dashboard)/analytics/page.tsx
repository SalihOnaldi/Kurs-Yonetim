"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import KpiCards from "@/components/analytics/KpiCards";
import LineChart from "@/components/analytics/Chart";

interface AnalyticsSummaryDto {
  totalStudents: number;
  activeCourses: number;
  averageOccupancy: number;
  documentsExpiringSoon: number;
  lowAttendanceCourses: number;
}

interface MonthlyRevenuePointDto {
  year: number;
  month: number;
  amount: number;
}

interface OccupancyTrendPointDto {
  date: string;
  occupancy: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummaryDto | null>(null);
  const [revenue, setRevenue] = useState<MonthlyRevenuePointDto[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyTrendPointDto[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me")
      .then(() => {
        setAuthorized(true);
        loadData();
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setError("");
      setLoading(true);
      const [summaryRes, revenueRes, occupancyRes] = await Promise.all([
        api.get<AnalyticsSummaryDto>("/analytics/summary"),
        api.get<MonthlyRevenuePointDto[]>("/analytics/monthly-revenue"),
        api.get<OccupancyTrendPointDto[]>("/analytics/occupancy-trend"),
      ]);
      setSummary(summaryRes.data);
      setRevenue(revenueRes.data || []);
      setOccupancy(occupancyRes.data || []);
    } catch (err: any) {
      console.error("Analytics load error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Analitik veriler yüklenirken bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  const revenueData = useMemo(() => {
    const labels = revenue.map((item) => `${item.month.toString().padStart(2, "0")}/${item.year}`);
    const values = revenue.map((item) => Number(item.amount.toFixed(2)));
    return { labels, values };
  }, [revenue]);

  const occupancyData = useMemo(() => {
    const labels = occupancy.map((item) =>
      new Date(item.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })
    );
    const values = occupancy.map((item) => Number((item.occupancy * 100).toFixed(2)));
    return { labels, values };
  }, [occupancy]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <div className="text-lg text-indigo-800 font-medium">Analitik paneli hazırlanıyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      <nav className="bg-white/90 backdrop-blur border-b border-indigo-100 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push("/menu")}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              ← Ana Menü
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              Yönetici Analitik Paneli
            </h1>
            <button
              onClick={loadData}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Yenile
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <KpiCards
          items={[
            {
              title: "Toplam Kursiyer",
              value: summary?.totalStudents ?? 0,
              icon: "👥",
              tone: "emerald",
            },
            {
              title: "Aktif Kurs",
              value: summary?.activeCourses ?? 0,
              icon: "📚",
              tone: "teal",
            },
            {
              title: "Doluluk Oranı",
              value: `${summary?.averageOccupancy ?? 0}%`,
              icon: "🏫",
              tone: "amber",
              description: "Son sınıf planlamalarına göre",
            },
            {
              title: "Takip Gerektiren",
              value: summary
                ? summary.documentsExpiringSoon + summary.lowAttendanceCourses
                : 0,
              icon: "⚠️",
              tone: "rose",
              description: summary
                ? `${summary.documentsExpiringSoon} belge, ${summary.lowAttendanceCourses} kurs`
                : undefined,
            },
          ]}
        />

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/90 backdrop-blur border border-indigo-100 rounded-2xl shadow-xl p-6 space-y-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                <span className="text-2xl">💰</span>
                Aylık Gelir Eğrisi
              </h2>
              <p className="text-sm text-indigo-600">Son 12 ayda tahsil edilen tutarların trendi</p>
            </header>
            {revenue.length === 0 ? (
              <div className="px-4 py-8 text-sm text-indigo-600 border border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50">
                Tahsil edilmiş ödeme kaydı bulunamadı.
              </div>
            ) : (
              <LineChart
                labels={revenueData.labels}
                datasetLabel="Tahsilat (₺)"
                data={revenueData.values}
                color="#6366f1"
              />
            )}
          </div>

          <div className="bg-white/90 backdrop-blur border border-indigo-100 rounded-2xl shadow-xl p-6 space-y-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                <span className="text-2xl">📈</span>
                Doluluk Eğilimi
              </h2>
              <p className="text-sm text-indigo-600">Son 30 günde yoklama bazlı doluluk oranı</p>
            </header>
            {occupancy.length === 0 ? (
              <div className="px-4 py-8 text-sm text-indigo-600 border border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50">
                Yoklama verisi bulunamadı.
              </div>
            ) : (
              <LineChart
                labels={occupancyData.labels}
                datasetLabel="Doluluk (%)"
                data={occupancyData.values}
                color="#10b981"
              />
            )}
          </div>
        </section>

        <section className="bg-white/90 backdrop-blur border border-indigo-100 rounded-2xl shadow-xl p-6 space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Analitik Öneriler
            </h2>
            <p className="text-sm text-indigo-600">
              Sistem verilerine göre gözden geçirmenizi önerdiğimiz maddeler
            </p>
          </header>
          <ul className="space-y-2 text-sm text-indigo-700">
            <li className="flex items-start gap-2">
              <span className="text-lg">🧑‍🏫</span>
              <span>
                {summary?.lowAttendanceCourses ?? 0} kursta yoklama oranı düşük görünüyor. Yoklama
                takibi ve öğretmen geri bildirimlerini kontrol edin.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg">📄</span>
              <span>
                {summary?.documentsExpiringSoon ?? 0} kursiyerin belgesi yakında sonlanıyor.
                Belge hatırlatma modülü ile otomatik bildirim gönderebilirsiniz.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg">🔍</span>
              <span>
                Gelir eğrisi belirgin bir düşüş gösteriyorsa, ödeme takibi ve geciken tahsilatlar
                için hatırlatma planlayın.
              </span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

