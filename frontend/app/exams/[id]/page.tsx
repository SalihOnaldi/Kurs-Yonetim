"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface ExamDetail {
  id: number;
  courseId: number;
  examType: string;
  examDate: string;
  mebSessionCode?: string | null;
  status: string;
  notes?: string | null;
  courseInfo: {
    id: number;
    srcType: number;
    groupInfo: {
      year: number;
      month: number;
      groupNo: number;
      branch?: string | null;
    };
  };
  results: ExamResult[];
  stats: {
    total: number;
    passed: number;
    failed: number;
    averageScore: number;
  };
  createdAt: string;
  updatedAt?: string | null;
}

interface ExamResult {
  id: number;
  studentInfo: {
    id: number;
    tcKimlikNo: string;
    firstName: string;
    lastName: string;
  };
  score: number;
  pass: boolean;
  attemptNo: number;
  notes?: string | null;
}

interface EditableResult extends ExamResult {
  dirty?: boolean;
  deleted?: boolean;
}

interface SavePayload {
  results: {
    studentId: number;
    score: number;
    pass?: boolean;
    attemptNo?: number;
    notes?: string | null;
  }[];
  markCompleted: boolean;
}

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const examId = Number(params.id);

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [results, setResults] = useState<EditableResult[]>([]);
  const [markCompleted, setMarkCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    if (!examId || Number.isNaN(examId)) {
      router.push("/exams");
      return;
    }

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
  }, [examId]);

  useEffect(() => {
    if (!authorized) return;
    loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const loadExam = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<ExamDetail>(`/exams/${examId}`);
      setExam(response.data);
      setResults(response.data.results.map((r) => ({ ...r, dirty: false, deleted: false })));
      setMarkCompleted(response.data.status === "completed");
    } catch (err: any) {
      console.error("Exam detail load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Sınav detayları yüklenirken bir hata oluştu.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("tr-TR", {
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

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("tr-TR");
    } catch {
      return iso;
    }
  };

  const maskTc = (tc: string) => {
    if (tc.length !== 11) return tc;
    return `${tc.slice(0, 3)}***${tc.slice(6)}`;
  };

  const examTypeText = (type: string) =>
    type === "practical" || type === "uygulama" ? "Uygulama" : "Yazılı";

  const handleResultChange = (
    resultId: number,
    field: keyof Omit<EditableResult, "studentInfo" | "dirty" | "deleted" | "id">,
    value: any
  ) => {
    setResults((prev) =>
      prev.map((result) =>
        result.id === resultId
          ? {
              ...result,
              [field]: value,
              dirty: true,
            }
          : result
      )
    );
  };

  const handleAddResult = () => {
    const studentId = parseInt(prompt("Öğrenci ID'sini girin:") || "", 10);
    if (!studentId) {
      alert("Geçerli bir öğrenci ID'si girmelisiniz.");
      return;
    }
    const firstName = prompt("Öğrenci adı:") || "Ad";
    const lastName = prompt("Öğrenci soyadı:") || "Soyad";

    const tempId = Date.now();
    setResults((prev) => [
      ...prev,
      {
        id: -tempId,
        studentInfo: {
          id: studentId,
          firstName,
          lastName,
          tcKimlikNo: "***********",
        },
        score: 0,
        pass: false,
        attemptNo: 1,
        notes: "",
        dirty: true,
        deleted: false,
      },
    ]);
  };

  const handleDeleteResult = (result: EditableResult) => {
    if (!confirm("Bu sınav sonucunu silmek istediğinize emin misiniz?")) {
      return;
    }

    if (result.id < 0) {
      setResults((prev) => prev.filter((r) => r.id !== result.id));
    } else {
      api
        .delete(`/exams/${examId}/results/${result.id}`)
        .then(() => loadExam())
        .catch((err: any) => {
          const message =
            err.response?.data?.message || err.message || "Kayıt silinirken hata oluştu.";
          alert(message);
        });
    }
  };

  const handleSaveResults = async () => {
    try {
      setSaving(true);
      setSaveMessage("");
      const payload: SavePayload = {
        results: results
          .filter((r) => r.dirty || r.id < 0)
          .map((r) => ({
            studentId: r.studentInfo.id,
            score: r.score,
            pass: r.pass,
            attemptNo: r.attemptNo,
            notes: r.notes,
          })),
        markCompleted,
      };

      if (payload.results.length === 0) {
        setSaveMessage("Kaydedilecek değişiklik bulunmuyor.");
        setSaving(false);
        return;
      }

      await api.post(`/exams/${examId}/results`, payload);
      setSaveMessage("Sınav sonuçları kaydedildi.");
      await loadExam();
    } catch (err: any) {
      console.error("Exam results save error:", err);
      const message =
        err.response?.data?.message || err.message || "Sınav sonuçları kaydedilirken hata oluştu.";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCsvImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!csvFile) {
      setImportError("Lütfen CSV dosyası seçin.");
      return;
    }
    try {
      setImporting(true);
      setImportError("");
      const formData = new FormData();
      formData.append("file", csvFile);
      await api.post(`/exams/${examId}/results/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCsvFile(null);
      await loadExam();
      alert("CSV import işlemi tamamlandı.");
    } catch (err: any) {
      console.error("CSV import error:", err);
      const message =
        err.response?.data?.message || err.message || "CSV dosyası içe aktarılırken hata oluştu.";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  const dirtyCount = useMemo(() => results.filter((r) => r.dirty && r.id >= 0).length, [results]);
  const newCount = useMemo(() => results.filter((r) => r.id < 0).length, [results]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Sınav detayları yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sınav bilgileri alınamadı</h1>
          <p className="text-gray-600 mb-6">{error || "Sınav bulunamadı."}</p>
          <button
            onClick={() => router.push("/exams")}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Sınav listesine dön
          </button>
        </div>
      </div>
    );
  }

  const { courseInfo } = exam;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
      <nav className="bg-white shadow-lg border-b-2 border-purple-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/exams")}
                className="text-purple-600 hover:text-purple-800 font-medium"
              >
                ← Sınavlara Dön
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {examTypeText(exam.examType)} Sınavı • {formatDate(exam.examDate)}
              </h1>
            </div>
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${
                exam.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : exam.status === "scheduled"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {exam.status === "completed"
                ? "Tamamlandı"
                : exam.status === "scheduled"
                ? "Planlandı"
                : "İptal"}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Sınav Tarihi"
              value={formatDateTime(exam.examDate)}
              subtitle={`Oluşturma: ${formatDateTime(exam.createdAt)}`}
              gradient="from-purple-500 to-purple-600"
              icon="🗓️"
            />
            <SummaryCard
              title="Katılımcı"
              value={exam.stats.total}
              subtitle={`Geçti: ${exam.stats.passed} • Kaldı: ${exam.stats.failed}`}
              gradient="from-pink-500 to-pink-600"
              icon="👥"
            />
            <SummaryCard
              title="Ortalama"
              value={`${exam.stats.averageScore.toFixed(1)}`}
              subtitle="Puan ortalaması"
              gradient="from-rose-500 to-rose-600"
              icon="📈"
            />
            <SummaryCard
              title="MEB Oturum"
              value={exam.mebSessionCode || "Belirtilmemiş"}
              subtitle={exam.notes || "Not yok"}
              gradient="from-indigo-500 to-indigo-600"
              icon="🏛️"
            />
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Kurs Bilgileri</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
              <DetailItem label="SRC Türü">SRC{courseInfo.srcType}</DetailItem>
              <DetailItem label="Grup">
                {courseInfo.groupInfo.year}-{courseInfo.groupInfo.month}-GRUP{" "}
                {courseInfo.groupInfo.groupNo}
              </DetailItem>
              <DetailItem label="Şube">
                {courseInfo.groupInfo.branch ? courseInfo.groupInfo.branch : "Merkez"}
              </DetailItem>
            </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sınav Sonuçları</h2>
                <p className="text-sm text-gray-500">
                  {dirtyCount > 0 || newCount > 0
                    ? `${dirtyCount} kayıt güncellendi, ${newCount} yeni kayıt eklendi.`
                    : "Herhangi bir değişiklik yapılmadı."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={markCompleted}
                    onChange={(e) => setMarkCompleted(e.target.checked)}
                  />
                  <span>Sınavı tamamlandı olarak işaretle</span>
                </label>
                <button
                  onClick={handleAddResult}
                  className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                >
                  + Yeni Sonuç
                </button>
                <button
                  onClick={handleSaveResults}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </header>
            {saveMessage && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
                {saveMessage}
              </div>
            )}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Kursiyer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Puan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Hak No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Not
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result) => (
                    <tr
                      key={result.id}
                      className={result.dirty || result.id < 0 ? "bg-purple-50" : ""}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {result.studentInfo.firstName} {result.studentInfo.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {maskTc(result.studentInfo.tcKimlikNo)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={result.score}
                          onChange={(e) =>
                            handleResultChange(result.id, "score", parseFloat(e.target.value))
                          }
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <select
                          value={result.pass ? "passed" : "failed"}
                          onChange={(e) =>
                            handleResultChange(result.id, "pass", e.target.value === "passed")
                          }
                          className="px-3 py-1 border border-gray-300 rounded"
                        >
                          <option value="passed">Geçti</option>
                          <option value="failed">Kaldı</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={result.attemptNo}
                          onChange={(e) =>
                            handleResultChange(result.id, "attemptNo", parseInt(e.target.value))
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="text"
                          value={result.notes || ""}
                          onChange={(e) =>
                            handleResultChange(result.id, "notes", e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                          placeholder="Opsiyonel"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteResult(result)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        Bu sınav için sonuç kaydı bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">CSV ile Sonuç İçe Aktar</h2>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert(
                    "Beklenen CSV formatı: studentId,score,pass(optional),attemptNo(optional),notes(optional)"
                  );
                }}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Örnek format
              </a>
            </header>
            <form onSubmit={handleCsvImport} className="flex flex-col md:flex-row gap-3 items-start">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="w-full md:w-auto"
              />
              <button
                type="submit"
                disabled={importing}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {importing ? "İçe aktarılıyor..." : "CSV Yükle"}
              </button>
              {importError && <span className="text-sm text-red-600">{importError}</span>}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  gradient,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  gradient: string;
  icon: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br ${gradient} overflow-hidden shadow-xl rounded-xl transform hover:scale-105 transition-transform duration-200`}
    >
      <div className="p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/80 uppercase tracking-wide">{title}</div>
            <div className="text-3xl font-bold mt-2">{value}</div>
            {subtitle && <div className="text-sm text-white/70 mt-2">{subtitle}</div>}
          </div>
          <div className="text-5xl opacity-20">{icon}</div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

