"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import StatCard from "@/components/portal/StatCard";
import Timeline from "@/components/portal/Timeline";

interface PortalStudentSession {
  studentId: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

interface PortalSummaryResponse {
  studentName: string;
  email?: string | null;
  phone?: string | null;
  totalCourses: number;
  activeCourses: number;
  upcomingLessons: number;
  pendingDocuments: number;
  pendingPayments: number;
  pendingPaymentAmount: number;
  lessons: {
    scheduleSlotId: number;
    startTime: string;
    endTime: string;
    subject?: string | null;
    courseLabel: string;
  }[];
}

interface PortalRecentAttendanceDto {
  attendanceId: number;
  isPresent: boolean;
  excuse?: string | null;
  startTime: string;
  endTime: string;
  subject?: string | null;
  courseLabel: string;
  markedAt?: string | null;
}

interface PortalDocumentDto {
  documentId: number;
  documentType: string;
  docDate?: string | null;
  isRequired: boolean;
  validationStatus: string;
  validationNotes?: string | null;
}

export default function PortalDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<PortalStudentSession | null>(null);
  const [summary, setSummary] = useState<PortalSummaryResponse | null>(null);
  const [attendance, setAttendance] = useState<PortalRecentAttendanceDto[]>([]);
  const [documents, setDocuments] = useState<PortalDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("portalStudent");
    if (!stored) {
      router.push("/portal/login");
      return;
    }
    const parsed = JSON.parse(stored) as PortalStudentSession;
    if (!parsed?.studentId || !parsed.tcKimlikNo) {
      router.push("/portal/login");
      return;
    }
    setSession(parsed);
    loadData(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (student: PortalStudentSession) => {
    try {
      setLoading(true);
      setError("");
      const query = `studentId=${student.studentId}&tcKimlikNo=${encodeURIComponent(student.tcKimlikNo)}`;

      const [summaryRes, attendanceRes, documentsRes] = await Promise.all([
        api.get<PortalSummaryResponse>(`/portal/summary?${query}`),
        api.get<PortalRecentAttendanceDto[]>(`/portal/attendance/recent?${query}`),
        api.get<PortalDocumentDto[]>(`/portal/documents?${query}`),
      ]);

      setSummary(summaryRes.data || null);
      setAttendance(attendanceRes.data || []);
      setDocuments(documentsRes.data || []);
    } catch (err: any) {
      console.error("Portal dashboard error:", err);
      setError(
        err.response?.data?.message || err.message || "Kursiyer verileri yüklenirken bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  const upcomingTimeline = useMemo(() => {
    return summary?.lessons.map((lesson) => ({
      id: lesson.scheduleSlotId,
      title: lesson.courseLabel,
      subtitle: lesson.subject || "Ders / Konu",
      meta: `${new Date(lesson.startTime).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })} • ${new Date(lesson.endTime).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      badge: "Yaklaşan Ders",
      badgeTone: "info" as const,
    })) ?? [];
  }, [summary?.lessons]);

  const attendanceTimeline = useMemo(
    () =>
      attendance.map((item) => {
        const tone: "success" | "warning" = item.isPresent ? "success" : "warning";
        return {
          id: item.attendanceId,
          title: item.courseLabel,
          subtitle: item.subject || "Ders / Konu",
          meta: `${new Date(item.startTime).toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          badge: item.isPresent ? "Katıldı" : "Katılmadı",
          badgeTone: tone,
        };
      }),
    [attendance]
  );

  const pendingDocuments = useMemo(() => {
    return documents.filter((doc) => doc.isRequired && doc.validationStatus !== "approved");
  }, [documents]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <div className="text-lg text-emerald-800 font-medium">Kursiyer verileriniz yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100">
      <nav className="bg-white/90 backdrop-blur border-b border-emerald-100 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-200 text-emerald-800 text-xl font-semibold">
                {session.firstName?.charAt(0)}
              </span>
              <div>
                <div className="text-sm text-emerald-700 uppercase tracking-wide">Kursiyer Portalı</div>
                <div className="text-lg font-semibold text-emerald-900">
                  {session.firstName} {session.lastName}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("portalStudent");
                router.push("/portal/login");
              }}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              Çıkış Yap
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

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Toplam Kurs"
            value={summary?.totalCourses ?? 0}
            icon="📚"
            accent="from-emerald-500 to-green-500"
          />
          <StatCard
            title="Aktif Kurs"
            value={summary?.activeCourses ?? 0}
            icon="🔥"
            accent="from-teal-500 to-cyan-500"
          />
          <StatCard
            title="Yaklaşan Ders"
            value={summary?.upcomingLessons ?? 0}
            icon="📅"
            accent="from-sky-500 to-indigo-500"
          />
          <StatCard
            title="Bekleyen Belgeler"
            value={summary?.pendingDocuments ?? 0}
            icon="📁"
            accent="from-amber-500 to-orange-500"
            footer={
              summary?.pendingPayments
                ? `${summary.pendingPayments} ödeme (${summary.pendingPaymentAmount.toLocaleString("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                  })})`
                : undefined
            }
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Timeline
            title="Yaklaşan Dersler"
            description="Önümüzdeki dönemde katılmanız gereken dersler"
            items={upcomingTimeline}
            emptyMessage="Planlanmış ders bulunmuyor."
          />

          <Timeline
            title="Son Yoklama Kayıtları"
            description="Katıldığınız veya kaçırdığınız son dersler"
            items={attendanceTimeline}
            emptyMessage="Henüz yoklama kaydı bulunmuyor."
          />
        </section>

        <section className="bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl shadow-xl p-6 space-y-4">
          <header className="space-y-1">
            <h3 className="text-lg font-semibold text-emerald-900">Belge Durumları</h3>
            <p className="text-sm text-emerald-700">
              Sistemde kayıtlı belgeleriniz ve doğrulama durumları. Eksik belgeleriniz varsa kurs
              yönetimi ile iletişime geçin.
            </p>
          </header>

          {documents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-emerald-700 border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/70">
              Kayıtlı belgeniz bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto border border-emerald-100 rounded-xl">
              <table className="min-w-full divide-y divide-emerald-100 text-sm">
                <thead className="bg-emerald-50/70 text-emerald-900">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Belge Türü
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Geçerlilik
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Durum
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Notlar
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {documents.map((doc) => (
                    <tr key={doc.documentId} className="hover:bg-emerald-50/60 transition">
                      <td className="px-4 py-3 text-emerald-900 font-medium">
                        {doc.documentType}
                        {doc.isRequired && (
                          <span className="ml-2 text-xs text-emerald-600 font-medium">Zorunlu</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-emerald-700">
                        {doc.docDate
                          ? new Date(doc.docDate).toLocaleDateString("tr-TR")
                          : "Belirtilmemiş"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            doc.validationStatus === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : doc.validationStatus === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {doc.validationStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-emerald-600">
                        {doc.validationNotes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {pendingDocuments.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl shadow-inner p-5 space-y-2">
            <h3 className="text-sm font-semibold text-amber-800">Dikkat edilmesi gereken belgeler</h3>
            <ul className="list-disc list-inside text-xs text-amber-700">
              {pendingDocuments.map((doc) => (
                <li key={doc.documentId}>
                  {doc.documentType} belgesi henüz onaylanmamış. {doc.docDate
                    ? `Son geçerlilik: ${new Date(doc.docDate).toLocaleDateString("tr-TR")}`
                    : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}


