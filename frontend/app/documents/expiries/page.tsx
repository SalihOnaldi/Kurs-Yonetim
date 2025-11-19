"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import ScheduleModal from "@/components/reminders/ScheduleModal";

interface ReminderStudent {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

interface ReminderDocument {
  id: number;
  documentType: string;
  docDate?: string | null;
}

interface ReminderListItem {
  id: number;
  type: string;
  channel: string;
  title: string;
  message: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  error?: string | null;
  student?: ReminderStudent | null;
  document?: ReminderDocument | null;
}

interface UpcomingDocument {
  documentId: number;
  documentType: string;
  docDate?: string | null;
  studentId: number;
  studentName: string;
  email?: string | null;
  phone?: string | null;
  hasPendingReminder: boolean;
}

const statusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "queued":
      return "bg-blue-100 text-blue-700";
    case "sent":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export default function DocumentExpiriesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [upcomingDocuments, setUpcomingDocuments] = useState<UpcomingDocument[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [error, setError] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{
    id: number;
    documentType: string;
    docDate?: string | null;
  } | null>(null);

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
      const [remindersRes, documentsRes] = await Promise.all([
        api.get<ReminderListItem[]>("/reminders?take=200"),
        api.get<UpcomingDocument[]>("/reminders/upcoming-documents?days=45&take=200"),
      ]);
      setReminders(remindersRes.data || []);
      setUpcomingDocuments(documentsRes.data || []);
    } catch (err: any) {
      console.error("Documents reminder load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Belge hatırlatma verileri yüklenirken bir hata oluştu.";
      setError(message);
    }
  };

  const filteredReminders = useMemo(() => {
    return reminders.filter((item) => (filterStatus === "all" ? true : item.status === filterStatus));
  }, [reminders, filterStatus]);

  const openScheduleModal = (document?: UpcomingDocument) => {
    if (document) {
      setSelectedStudent({
        id: document.studentId,
        name: document.studentName,
        email: document.email,
        phone: document.phone,
      });
      setSelectedDocument({
        id: document.documentId,
        documentType: document.documentType,
        docDate: document.docDate ?? undefined,
      });
    } else {
      setSelectedStudent(null);
      setSelectedDocument(null);
    }
    setScheduleModalOpen(true);
  };

  const handleCancelReminder = async (id: number) => {
    if (!confirm("Bu hatırlatmayı iptal etmek istediğinize emin misiniz?")) {
      return;
    }
    try {
      await api.post(`/reminders/${id}/cancel`);
      await loadData();
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Hatırlatma iptal edilirken bir hata oluştu.";
      alert(message);
    }
  };

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <div className="text-lg text-emerald-800 font-medium">Belge hatırlatmaları yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100">
      <nav className="bg-white/90 backdrop-blur border-b border-emerald-100 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push("/menu")}
              className="text-emerald-600 hover:text-emerald-800 font-medium"
            >
              ← Ana Menü
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-emerald-900 flex items-center gap-2">
              <span className="text-3xl">📁</span>
              Belge Hatırlatmaları
            </h1>
            <button
              onClick={loadData}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              Yenile
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <section className="bg-white/90 backdrop-blur border border-emerald-100 shadow-xl rounded-2xl p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  Yaklaşan Belge Bitişleri (45 gün)
                </h2>
                <p className="text-sm text-emerald-700">
                  Süresi yaklaşan belgeleri kontrol edin ve gerekirse hatırlatma planlayın.
                </p>
              </div>
              <button
                onClick={() => openScheduleModal()}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl shadow-md hover:from-emerald-700 hover:to-green-700 font-semibold transition"
              >
                + Manuel Hatırlatma Planla
              </button>
            </div>

            {upcomingDocuments.length === 0 ? (
              <div className="px-6 py-12 border border-dashed border-emerald-200 rounded-2xl text-center bg-emerald-50/70 text-emerald-700">
                Yaklaşan belge son kullanma tarihi bulunamadı.
              </div>
            ) : (
              <div className="overflow-x-auto border border-emerald-100 rounded-xl">
                <table className="min-w-full divide-y divide-emerald-100 text-sm">
                  <thead className="bg-emerald-50/70 text-emerald-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Kursiyer
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Belge
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Bitiş Tarihi
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        İletişim
                      </th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-xs">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50">
                    {upcomingDocuments.map((doc) => (
                      <tr key={doc.documentId} className="hover:bg-emerald-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-900">{doc.studentName}</div>
                          <div className="text-xs text-emerald-600">
                            {doc.email || "-"} • {doc.phone || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-emerald-800 font-medium">{doc.documentType}</td>
                        <td className="px-4 py-3 text-emerald-700">
                          {doc.docDate
                            ? new Date(doc.docDate).toLocaleDateString("tr-TR")
                            : "Belirtilmemiş"}
                        </td>
                        <td className="px-4 py-3 text-xs text-emerald-600">
                          {doc.hasPendingReminder ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              Planlanmış hatırlatma var
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                              Hatırlatma bekleniyor
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openScheduleModal(doc)}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                          >
                            Hatırlatma Planla
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white/90 backdrop-blur border border-emerald-100 shadow-xl rounded-2xl p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                  <span className="text-2xl">🗂️</span>
                  Hatırlatma Listesi
                </h2>
                <p className="text-sm text-emerald-700">
                  Planlanmış, gönderilmiş veya başarısız olmuş hatırlatmaları takip edin.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Durum:</label>
                <select
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className="px-3 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="pending">Bekleyen</option>
                  <option value="queued">Kuyrukta</option>
                  <option value="sent">Gönderildi</option>
                  <option value="failed">Hatalı</option>
                  <option value="cancelled">İptal</option>
                  <option value="all">Tümü</option>
                </select>
              </div>
            </div>

            {filteredReminders.length === 0 ? (
              <div className="px-6 py-12 border border-dashed border-emerald-200 rounded-2xl text-center bg-emerald-50/70 text-emerald-700">
                Seçili durum için hatırlatma bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto border border-emerald-100 rounded-xl">
                <table className="min-w-full divide-y divide-emerald-100 text-sm">
                  <thead className="bg-emerald-50/70 text-emerald-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Kursiyer
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Belge / Başlık
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Zamanlama
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                        Durum
                      </th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-xs">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50">
                    {filteredReminders.map((item) => (
                      <tr key={item.id} className="hover:bg-emerald-50/70 transition">
                        <td className="px-4 py-3">
                          {item.student ? (
                            <>
                              <div className="font-semibold text-emerald-900">
                                {item.student.firstName} {item.student.lastName}
                              </div>
                              <div className="text-xs text-emerald-600">
                                {item.student.email || "-"} • {item.student.phone || "-"}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-emerald-600">Kursiyer bilgisi yok</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-emerald-800">
                          <div className="font-semibold">{item.title}</div>
                          {item.document && (
                            <div className="text-xs text-emerald-600">
                              {item.document.documentType} •{" "}
                              {item.document.docDate
                                ? new Date(item.document.docDate).toLocaleDateString("tr-TR")
                                : "Belirtilmemiş"}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-emerald-700 text-xs">
                          <div>
                            Planlanan: {new Date(item.scheduledAt).toLocaleString("tr-TR")}
                          </div>
                          {item.sentAt && (
                            <div className="text-emerald-500 mt-1">
                              Gönderildi: {new Date(item.sentAt).toLocaleString("tr-TR")}
                            </div>
                          )}
                          <div className="mt-1 text-gray-500">Kanal: {item.channel.toUpperCase()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(item.status)}`}>
                            {item.status.toUpperCase()}
                          </span>
                          {item.error && (
                            <div className="text-xs text-red-600 mt-1">Hata: {item.error}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {item.status === "pending" || item.status === "queued" ? (
                            <button
                              onClick={() => handleCancelReminder(item.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50 transition"
                            >
                              İptal Et
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      <ScheduleModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onScheduled={loadData}
        initialStudent={selectedStudent ?? undefined}
        initialDocument={selectedDocument ?? undefined}
      />
    </div>
  );
}


