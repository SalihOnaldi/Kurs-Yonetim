"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import TenantSwitcher from "@/components/tenant/TenantSwitcher";

interface DashboardSummary {
  activeCourseCount: number;
  totalStudentCount: number;
  pendingMebbisTransferJobs: number;
  upcomingExamCount: number;
}

interface ScheduleItem {
  id: number;
  course: {
    id: number;
    srcType: number;
    group: {
      year: number;
      month: number;
      groupNo: number;
      branch?: string | null;
    };
  };
  instructor?: {
    id: number;
    fullName: string;
    username: string;
  } | null;
  subject?: string | null;
  classroomName?: string | null;
  startTime: string;
  endTime: string;
  attendanceCount: number;
}

interface UpcomingExam {
  id: number;
  examType: string;
  examDate: string;
  status: string;
  mebSessionCode?: string | null;
  course: {
    id: number;
    srcType: number;
    group: {
      year: number;
      month: number;
      groupNo: number;
      branch?: string | null;
    };
  };
}

interface AlertTransfer {
  id: number;
  mode: string;
  status: string;
  successCount: number;
  failureCount: number;
  errorMessage?: string | null;
  createdAt: string;
  course: {
    id: number;
    srcType: number;
    group: {
      year: number;
      month: number;
      groupNo: number;
      branch?: string | null;
    };
  };
}

interface AlertPayment {
  id: number;
  amount: number;
  paymentType: string;
  dueDate: string;
  penaltyAmount?: number | null;
  student: {
    id: number;
    firstName: string;
    lastName: string;
    tcKimlikNo: string;
  };
}

interface DashboardAlerts {
  failedMebbisTransfers: AlertTransfer[];
  overduePayments: AlertPayment[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    const userStr = localStorage.getItem("user");
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      // Admin kullanıcısı şube ekranına erişemez
      if (parsedUser?.role === "PlatformOwner") {
        router.push("/hq/dashboard");
        return;
      }
    }

    api
      .get("/auth/me")
      .then((response) => {
        const userData = response.data;
        setUser(userData);
        // Admin kullanıcısı şube ekranına erişemez
        if (userData?.role === "PlatformOwner") {
          router.push("/hq/dashboard");
          return;
        }
        loadDashboardData();
      })
      .catch(() => {
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [summaryRes, scheduleRes, examsRes, alertsRes] = await Promise.all([
        api.get<DashboardSummary>("/dashboard/summary"),
        api.get<ScheduleItem[]>("/dashboard/today-schedule"),
        api.get<UpcomingExam[]>("/dashboard/upcoming-exams?days=14"),
        api.get<DashboardAlerts>("/dashboard/alerts"),
      ]);

      const summaryData = summaryRes.data as any;
      const normalizedSummary: DashboardSummary = {
        activeCourseCount: summaryData.activeCourseCount ?? summaryData.ActiveCourseCount ?? 0,
        totalStudentCount: summaryData.totalStudentCount ?? summaryData.TotalStudentCount ?? 0,
        pendingMebbisTransferJobs:
          summaryData.pendingMebbisTransferJobs ?? summaryData.PendingMebbisTransferJobs ?? 0,
        upcomingExamCount: summaryData.upcomingExamCount ?? summaryData.UpcomingExamCount ?? 0,
      };

      setSummary(normalizedSummary);
      setSchedule(scheduleRes.data || []);
      setUpcomingExams(examsRes.data || []);
      setAlerts(alertsRes.data);
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Gösterge paneli verileri yüklenirken bir hata oluştu.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    });
  };

  const totalPendingAmount = useMemo(() => {
    if (!alerts?.overduePayments?.length) return 0;
    return alerts.overduePayments.reduce(
      (sum, item) => sum + item.amount + (item.penaltyAmount ?? 0),
      0
    );
  }, [alerts?.overduePayments]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-700 font-medium">Gösterge paneli yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <nav className="bg-white shadow-lg border-b-2 border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                SRC Kurs Yönetim Sistemi
              </h1>
              <TenantSwitcher className="hidden md:block" />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/menu")}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"
              >
                Ana Menü
              </button>
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.fullName || user?.username}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Toplam Kursiyer"
              value={summary?.totalStudentCount ?? 0}
              icon="👥"
              gradient="from-blue-500 to-blue-600"
            />
            <StatCard
              title="Aktif Kurs"
              value={summary?.activeCourseCount ?? 0}
              icon="📚"
              gradient="from-green-500 to-green-600"
            />
            <StatCard
              title="Yaklaşan Sınav (14 gün)"
              value={summary?.upcomingExamCount ?? 0}
              icon="📝"
              gradient="from-purple-500 to-purple-600"
            />
            <StatCard
              title="Bekleyen MEB Aktarımı"
              value={summary?.pendingMebbisTransferJobs ?? 0}
              icon="📤"
              gradient="from-orange-500 to-orange-600"
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-gray-100 shadow-xl rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  Bugünkü Dersler
                </h2>
                <button
                  onClick={() => router.push("/schedule")}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Ders Programına Git →
                </button>
              </div>
              {schedule.length === 0 ? (
                <EmptyState message="Bugün planlanmış ders bulunmuyor." />
              ) : (
                <div className="space-y-3">
                  {schedule.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-100 rounded-xl p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-transparent"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="text-sm text-gray-500 font-semibold mb-1">
                            {formatDateTime(item.startTime)} - {formatDateTime(item.endTime)}
                          </div>
                          <div className="text-base font-semibold text-gray-900">
                            {item.subject || "Ders / Konu"}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            SRC{item.course.srcType} • {item.course.group.year}-
                            {item.course.group.month}-GRUP {item.course.group.groupNo}
                            {item.course.group.branch ? ` (${item.course.group.branch})` : ""}
                          </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-2 text-sm">
                          {item.classroomName && (
                            <span className="px-3 py-1 rounded-full bg-white border border-blue-100 text-blue-700">
                              Derslik: {item.classroomName}
                            </span>
                          )}
                          {item.instructor && (
                            <span className="px-3 py-1 rounded-full bg-white border border-purple-100 text-purple-700">
                              Eğitmen: {item.instructor.fullName}
                            </span>
                          )}
                          <span className="px-3 py-1 rounded-full bg-white border border-green-100 text-green-700">
                            Yoklama: {item.attendanceCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl">📝</span>
                    Yaklaşan Sınavlar
                  </h2>
                  <button
                    onClick={() => router.push("/exams")}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Sınav Listesi →
                  </button>
                </div>
                {upcomingExams.length === 0 ? (
                  <EmptyState message="Önümüzdeki 14 gün içerisinde sınav bulunmuyor." />
                ) : (
                  <div className="space-y-3">
                    {upcomingExams.slice(0, 5).map((exam) => (
                      <div
                        key={exam.id}
                        className="border border-gray-100 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-transparent"
                      >
                        <div className="text-sm text-gray-500 font-semibold">
                          {formatDate(exam.examDate)}
                        </div>
                        <div className="text-base font-semibold text-gray-900 mt-1">
                          {exam.examType === "practical" ? "Uygulama" : "Yazılı"} Sınav
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          SRC{exam.course.srcType} • {exam.course.group.year}-
                          {exam.course.group.month}-GRUP {exam.course.group.groupNo}
                          {exam.course.group.branch ? ` (${exam.course.group.branch})` : ""}
                        </div>
                        {exam.mebSessionCode && (
                          <div className="text-xs text-gray-500 mt-1">
                            MEB Oturum Kodu: {exam.mebSessionCode}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-2xl">🚨</span>
                    Uyarılar
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => router.push("/notifications")}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Bildirim Merkezi →
                    </button>
                    <button
                      onClick={loadDashboardData}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Yenile
                    </button>
                  </div>
                </div>
                {!alerts ||
                (alerts.failedMebbisTransfers.length === 0 &&
                  alerts.overduePayments.length === 0) ? (
                  <EmptyState message="Tüm sistemler düzgün çalışıyor. 🎉" />
                ) : (
                  <div className="space-y-4">
                    {alerts.failedMebbisTransfers.length > 0 && (
                      <div className="border border-red-100 rounded-xl p-4 bg-red-50">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-red-700">
                            Son 7 günde başarısız MEBBİS aktarımı
                          </h3>
                          <button
                            onClick={() => router.push("/mebbis-transfer")}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            MEBBİS Transfer →
                          </button>
                        </div>
                        <div className="space-y-2">
                          {alerts.failedMebbisTransfers.slice(0, 3).map((job) => (
                            <div key={job.id} className="text-xs text-red-700">
                              <div className="font-semibold">
                                SRC{job.course.srcType} • {job.course.group.year}-
                                {job.course.group.month}-GRUP {job.course.group.groupNo}{" "}
                                {job.course.group.branch ? `(${job.course.group.branch})` : ""}
                              </div>
                              <div>
                                {formatDate(job.createdAt)} • {job.mode === "live" ? "Canlı" : "Dry Run"} •
                                Başarılı: {job.successCount} / Hatalı: {job.failureCount}
                              </div>
                              {job.errorMessage && (
                                <div className="italic">Hata: {job.errorMessage}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {alerts.overduePayments.length > 0 && (
                      <div className="border border-amber-100 rounded-xl p-4 bg-amber-50">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-amber-700">
                            Vadesi geçmiş ödemeler ({alerts.overduePayments.length})
                          </h3>
                          <div className="text-xs text-amber-700 font-semibold">
                            Toplam: {formatCurrency(totalPendingAmount)}
                          </div>
                        </div>
                        <div className="space-y-2 text-xs text-amber-700">
                          {alerts.overduePayments.slice(0, 5).map((payment) => (
                            <div key={payment.id} className="flex justify-between">
                              <span>
                                {payment.student.firstName} {payment.student.lastName} •
                                {formatDate(payment.dueDate)}
                              </span>
                              <span>{formatCurrency(payment.amount + (payment.penaltyAmount ?? 0))}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => router.push("/payments")}
                          className="mt-3 text-xs text-amber-600 hover:text-amber-800"
                        >
                          Ödeme listesine git →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white shadow-xl rounded-xl p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="mr-3 text-3xl">⚡</span>
              Hızlı İşlemler
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <QuickLink
                href="/students"
                icon="👥"
                title="Kursiyer Yönetimi"
                description="Kursiyer kayıt, arama ve evrak yönetimi"
                gradient="from-blue-200 to-indigo-200"
              />
              <QuickLink
                href="/courses"
                icon="📚"
                title="Kurs Yönetimi"
                description="Kurs oluşturma, takvim ve kursiyer yönetimi"
                gradient="from-green-200 to-lime-200"
              />
              <QuickLink
                href="/exams"
                icon="📝"
                title="Sınav Yönetimi"
                description="Sınav planlama ve sonuç kayıtları"
                gradient="from-purple-200 to-pink-200"
              />
              <QuickLink
                href="/mebbis-transfer"
                icon="📤"
                title="MEBBİS Aktarımı"
                description="Dry run ve canlı aktarım operasyonları"
                gradient="from-orange-200 to-yellow-200"
              />
              <QuickLink
                href="/reports"
                icon="📊"
                title="Raporlar"
                description="MEB formatlı rapor ve listeler"
                gradient="from-sky-200 to-cyan-200"
              />
              <QuickLink
                href="/menu#communications"
                icon="📨"
                title="SMS & E-Posta"
                description="Tekil veya toplu SMS/E-posta gönderimi"
                gradient="from-amber-200 to-orange-200"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({
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
    <div
      className={`bg-gradient-to-br ${gradient} overflow-hidden shadow-xl rounded-xl transform hover:scale-105 transition-transform duration-200`}
    >
      <div className="p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-4xl font-bold mb-2">{value}</div>
            <div className="text-white/80 text-sm font-medium">{title}</div>
          </div>
          <div className="text-5xl opacity-20">{icon}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center border border-dashed border-gray-200 rounded-xl text-gray-500 bg-gray-50">
      {message}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
  gradient,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <a
      href={href}
      className={`group p-6 border-2 border-transparent rounded-xl bg-gradient-to-br ${gradient} hover:border-blue-300 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl`}
    >
      <div className="flex items-center mb-3">
        <div className="text-4xl mr-4">{icon}</div>
        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700">{title}</h3>
      </div>
      <p className="text-sm text-gray-700 group-hover:text-gray-800">{description}</p>
    </a>
  );
}

