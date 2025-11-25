"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface SyncLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  status: string;
  response?: string | null;
  error?: string | null;
  createdAt: string;
}

interface ActionState {
  mebGroupId: string;
  enrollmentId: string;
  documentId: string;
}

export default function MebbisIntegrationPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionState, setActionState] = useState<ActionState>({
    mebGroupId: "",
    enrollmentId: "",
    documentId: "",
  });
  const [submitting, setSubmitting] = useState(false);

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
        loadLogs();
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilter]);

  const loadLogs = async () => {
    try {
      setError("");
      const params = logFilter === "all" ? "" : `?entityType=${logFilter}`;
      const response = await api.get<SyncLog[]>(`/mebbis/logs${params}`);
      setLogs(response.data || []);
    } catch (err: any) {
      console.error("MEBBIS logs error:", err);
      setError(err.response?.data?.message || err.message || "Log kayıtları alınamadı.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>, type: "course" | "enrollment" | "document") => {
    event.preventDefault();
    setSuccess("");
    setError("");
    let endpoint = "";
    let idValue = "";

    switch (type) {
      case "course":
        idValue = actionState.mebGroupId.trim();
        endpoint = `/mebbis/groups/${idValue}/push`;
        break;
      case "enrollment":
        idValue = actionState.enrollmentId.trim();
        endpoint = `/mebbis/enrollments/${idValue}/push`;
        break;
      case "document":
        idValue = actionState.documentId.trim();
        endpoint = `/mebbis/documents/${idValue}/approve`;
        break;
    }

    if (!idValue) {
      setError("Lütfen geçerli bir ID değeri girin.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(endpoint);
      setSuccess(response.data?.message || "İşlem başarıyla tamamlandı.");
      await loadLogs();
    } catch (err: any) {
      console.error("MEBBIS action error:", err);
      setError(err.response?.data?.message || err.message || "İşlem sırasında hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <div className="text-lg text-emerald-800 font-medium">MEBBİS entegrasyonu hazırlanıyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100">
      <nav className="bg-white/90 backdrop-blur border-b border-emerald-100 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push("/menu")}
              className="text-emerald-600 hover:text-emerald-800 font-medium"
            >
              ← Ana Menü
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-emerald-900 flex items-center gap-2">
              <span className="text-3xl">🛰️</span>
              MEBBİS Mock Entegrasyonu
            </h1>
            <button
              onClick={loadLogs}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              Logları Yenile
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(event) => handleSubmit(event, "course")}
            className="bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl shadow-xl p-6 space-y-4"
          >
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <span className="text-2xl">📚</span>
                Kursu MEBBİS’e Gönder
              </h2>
              <p className="text-sm text-emerald-700">
                Kurs bilgisi MEBBİS’e aktarılarak kayıt oluşturulur.
              </p>
            </header>
            <input
              type="number"
              min={1}
              value={actionState.mebGroupId}
              onChange={(event) => setActionState((prev) => ({ ...prev, mebGroupId: event.target.value }))}
              placeholder="Sınıf ID"
              className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:from-emerald-700 hover:to-green-700 disabled:opacity-60"
            >
              {submitting ? "İşleniyor..." : "Kursu Gönder"}
            </button>
          </form>

          <form
            onSubmit={(event) => handleSubmit(event, "enrollment")}
            className="bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl shadow-xl p-6 space-y-4"
          >
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <span className="text-2xl">👤</span>
                Öğrenciyi Gönder
              </h2>
              <p className="text-sm text-emerald-700">
                Kursiyer kaydı MEBBİS’e aktarılır ve takip edilebilir.
              </p>
            </header>
            <input
              type="number"
              min={1}
              value={actionState.enrollmentId}
              onChange={(event) =>
                setActionState((prev) => ({ ...prev, enrollmentId: event.target.value }))
              }
              placeholder="Enrollment ID"
              className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:from-sky-700 hover:to-blue-700 disabled:opacity-60"
            >
              {submitting ? "İşleniyor..." : "Öğrenciyi Gönder"}
            </button>
          </form>

          <form
            onSubmit={(event) => handleSubmit(event, "document")}
            className="bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl shadow-xl p-6 space-y-4"
          >
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <span className="text-2xl">📄</span>
                Belgeyi Onayla
              </h2>
              <p className="text-sm text-emerald-700">
                Yüklenen belgeleri mock e-Devlet üzerinden onaylayın.
              </p>
            </header>
            <input
              type="number"
              min={1}
              value={actionState.documentId}
              onChange={(event) =>
                setActionState((prev) => ({ ...prev, documentId: event.target.value }))
              }
              placeholder="Belge ID"
              className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-semibold shadow-lg hover:from-amber-700 hover:to-orange-700 disabled:opacity-60"
            >
              {submitting ? "İşleniyor..." : "Belgeyi Onayla"}
            </button>
          </form>
        </section>

        {(error || success) && (
          <div
            className={`px-4 py-3 rounded-lg ${error ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}
          >
            {error || success}
          </div>
        )}

        <section className="bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl shadow-xl p-6 space-y-4">
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <span className="text-2xl">🗂️</span>
                İşlem Logları
              </h2>
              <p className="text-sm text-emerald-700">
                Mock entegrasyon üzerinden yapılan son işlemler listelenir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-emerald-700">Filtre:</label>
              <select
                value={logFilter}
                onChange={(event) => setLogFilter(event.target.value)}
                className="px-3 py-2 text-sm border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tümü</option>
                <option value="course">Kurs</option>
                <option value="enrollment">Öğrenci</option>
                <option value="document">Belge</option>
              </select>
            </div>
          </header>

          {logs.length === 0 ? (
            <div className="px-4 py-6 text-sm text-emerald-700 border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/70">
              Kayıtlı log bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto border border-emerald-100 rounded-xl">
              <table className="min-w-full divide-y divide-emerald-100 text-sm">
                <thead className="bg-emerald-50/70 text-emerald-900">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Tarih
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      İşlem
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Sonuç
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs">
                      Mesaj
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-emerald-50/60 transition">
                      <td className="px-4 py-3 text-xs text-emerald-700">
                        {new Date(log.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-4 py-3 text-emerald-900 font-medium">
                        {log.entityType.toUpperCase()} #{log.entityId} • {log.action.toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            log.status === "success"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-emerald-600">
                        {log.status === "success" ? log.response : log.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

