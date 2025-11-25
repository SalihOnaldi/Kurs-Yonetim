"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "@/components/Toast";
import { logger } from "@/utils/logger";

interface ExamDetail {
  id: number;
  mebGroupId: number;
  examType: string;
  examDate: string;
  mebSessionCode?: string | null;
  status: string;
  notes?: string | null;
  groupInfo: {
    id: number;
    srcType: number;
      year: number;
      month: number;
      groupNo: number;
      branch?: string | null;
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
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

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
    loadGroups();
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
      logger.error("Exam detail load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Sınav detayları yüklenirken bir hata oluştu.";
      setError(message);
      toast.error(message);
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

  const loadGroups = async () => {
    try {
      const response = await api.get("/courses/groups");
      setGroups(response.data || []);
    } catch (error) {
      logger.error("Groups load error:", error);
      // Fallback: Boş array
      setGroups([]);
    }
  };

  const loadStudentsFromGroups = async () => {
    if (selectedGroupIds.length === 0) {
      toast.warning("Lütfen en az bir sınıf seçin.");
      return;
    }

    try {
      setLoadingStudents(true);
      const allStudents: any[] = [];
      
      for (const groupId of selectedGroupIds) {
        const response = await api.get(`/exams/groups/${groupId}/students`);
        const students = response.data || [];
        allStudents.push(...students);
      }

      // Duplicate'leri kaldır ve selected property ekle
      const uniqueStudents = Array.from(
        new Map(allStudents.map((s) => [s.id, s])).values()
      ).map((s) => ({ ...s, selected: false }));
      
      setAvailableStudents(uniqueStudents);
      setShowStudentSelector(true);
    } catch (error: any) {
      const message = error.response?.data?.message || "Öğrenciler yüklenirken hata oluştu.";
      toast.error(message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadEligibleStudentsForPractical = async () => {
    if (!exam) return;
    
    try {
      setLoadingStudents(true);
      
      // Önce aynı kurs için yazılı sınavı bul
      const examsResponse = await api.get(`/exams?mebGroupId=${exam.mebGroupId}`);
      const allExams = examsResponse.data?.items || [];
      const writtenExam = allExams.find(
        (e: any) =>
          e.mebGroupId === exam.mebGroupId &&
          (e.examType?.toLowerCase() === "yazili" || e.examType?.toLowerCase() === "written") &&
          e.status === "completed"
      );
      
      if (!writtenExam) {
        toast.warning("Bu sınıf için tamamlanmış yazılı sınav bulunamadı.");
        return;
      }
      
      const response = await api.get(
        `/exams/practical/eligible-students?mebGroupId=${exam.mebGroupId}&writtenExamId=${writtenExam.id}`
      );
      const students = response.data || [];
      
      if (students.length === 0) {
        toast.info("Yazılı sınavı geçen öğrenci bulunamadı.");
        return;
      }
      
      // Mevcut sonuçlara ekle
      const existingStudentIds = new Set(results.map((r) => r.studentInfo.id));
      const newStudents = students.filter((s: any) => !existingStudentIds.has(s.studentId));
      
      if (newStudents.length === 0) {
        toast.info("Tüm yazılıyı geçen öğrenciler zaten eklenmiş.");
        return;
      }
      
      const tempResults = newStudents.map((student: any) => ({
        id: -Date.now() - Math.random(),
        studentInfo: {
          id: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          tcKimlikNo: student.tcKimlikNo,
        },
        score: 0,
        pass: false,
        attemptNo: 1,
        notes: "",
        dirty: true,
        deleted: false,
      }));
      
      setResults((prev) => [...prev, ...tempResults]);
      toast.success(`${newStudents.length} öğrenci eklendi.`);
    } catch (error: any) {
      const message = error.response?.data?.message || "Yazılıyı geçen öğrenciler yüklenirken hata oluştu.";
      toast.error(message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleAddResult = () => {
    const studentId = parseInt(prompt("Öğrenci ID'sini girin:") || "", 10);
    if (!studentId) {
      toast.warning("Geçerli bir öğrenci ID'si girmelisiniz.");
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

  const handleAddSelectedStudents = () => {
    const selected = availableStudents.filter((s) => s.selected);
    if (selected.length === 0) {
      toast.warning("Lütfen en az bir öğrenci seçin.");
      return;
    }

    const existingStudentIds = new Set(results.map((r) => r.studentInfo.id));
    const newResults = selected
      .filter((s) => !existingStudentIds.has(s.id))
      .map((student) => ({
        id: -Date.now() - Math.random(),
        studentInfo: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          tcKimlikNo: student.tcKimlikNo || "***********",
        },
        score: 0,
        pass: false,
        attemptNo: 1,
        notes: "",
        dirty: true,
        deleted: false,
      }));

    setResults((prev) => [...prev, ...newResults]);
    setShowStudentSelector(false);
    setAvailableStudents([]);
    setSelectedGroupIds([]);
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
          toast.error(message);
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
      toast.success("Sınav sonuçları başarıyla kaydedildi.");
      await loadExam();
    } catch (err: any) {
      logger.error("Exam results save error:", err);
      const message =
        err.response?.data?.message || err.message || "Sınav sonuçları kaydedilirken hata oluştu.";
      toast.error(message);
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
      toast.success("CSV import işlemi tamamlandı.");
    } catch (err: any) {
      logger.error("CSV import error:", err);
      const message =
        err.response?.data?.message || err.message || "CSV dosyası içe aktarılırken hata oluştu.";
      setImportError(message);
      toast.error(message);
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
                {(exam.examType === "yazili" || exam.examType === "written") && (
                  <button
                    onClick={() => setShowStudentSelector(!showStudentSelector)}
                    className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
                  >
                    📋 Sınıftan Öğrenci Seç
                  </button>
                )}
                {(exam.examType === "uygulama" || exam.examType === "practical") && (
                  <>
                    <button
                      onClick={loadEligibleStudentsForPractical}
                      disabled={loadingStudents}
                      className="px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
                    >
                      {loadingStudents ? "Yükleniyor..." : "✅ Yazılıyı Geçenleri Getir"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Pratik sınavı geçen tüm öğrenciler için otomatik sertifika oluşturulsun mu?")) {
                          return;
                        }
                        try {
                          const response = await api.post(`/exams/practical/${examId}/auto-generate-certificates`);
                          toast.success(`Başarılı! ${response.data.certificatesGenerated} sertifika oluşturuldu.`);
                        } catch (error: any) {
                          const message = error.response?.data?.message || "Sertifika oluşturulurken hata oluştu.";
                          toast.error(message);
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700"
                    >
                      🎓 Sertifika Oluştur
                    </button>
                  </>
                )}
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
                          onChange={(e) => {
                            const score = parseFloat(e.target.value) || 0;
                            const pass = score >= 70; // 70 üstü geçer
                            handleResultChange(result.id, "score", score);
                            handleResultChange(result.id, "pass", pass);
                          }}
                          className={`w-24 px-2 py-1 border rounded ${
                            result.score >= 70
                              ? "border-green-500 bg-green-50"
                              : result.score > 0
                              ? "border-red-500 bg-red-50"
                              : "border-gray-300"
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            result.pass
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {result.pass ? "✅ Geçti" : "❌ Kaldı"}
                        </span>
                        {result.score > 0 && result.score < 70 && (
                          <div className="text-xs text-gray-500 mt-1">
                            (70 gerekli)
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={result.attemptNo}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 1 && value <= 4) {
                              handleResultChange(result.id, "attemptNo", value);
                            }
                          }}
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
                  toast.info(
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

          {/* Sınıf Seçimi Modal */}
          {showStudentSelector && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-900">Sınıftan Öğrenci Seç</h3>
                  <button
                    onClick={() => {
                      setShowStudentSelector(false);
                      setAvailableStudents([]);
                      setSelectedGroupIds([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sınıfları Seçin (Çoklu seçim yapabilirsiniz)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {groups.map((group) => (
                        <label
                          key={group.id}
                          className={`flex items-center p-2 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedGroupIds.includes(group.id)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupIds([...selectedGroupIds, group.id]);
                              } else {
                                setSelectedGroupIds(selectedGroupIds.filter((id) => id !== group.id));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                          />
                          <span className="text-sm text-gray-700">{group.name}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={loadStudentsFromGroups}
                      disabled={loadingStudents || selectedGroupIds.length === 0}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingStudents ? "Yükleniyor..." : "Öğrencileri Yükle"}
                    </button>
                  </div>

                  {availableStudents.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Öğrenciler ({availableStudents.filter((s) => s.selected).length} seçili)
                        </h4>
                        <button
                          onClick={() => {
                            setAvailableStudents((prev) =>
                              prev.map((s) => ({ ...s, selected: !s.selected }))
                            );
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Tümünü Seç/Kaldır
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                                <input
                                  type="checkbox"
                                  checked={availableStudents.every((s) => s.selected)}
                                  onChange={(e) => {
                                    setAvailableStudents((prev) =>
                                      prev.map((s) => ({ ...s, selected: e.target.checked }))
                                    );
                                  }}
                                  className="h-4 w-4"
                                />
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                                Öğrenci
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                                TC Kimlik No
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {availableStudents.map((student) => (
                              <tr
                                key={student.id}
                                className={student.selected ? "bg-blue-50" : ""}
                              >
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    checked={student.selected || false}
                                    onChange={(e) => {
                                      setAvailableStudents((prev) =>
                                        prev.map((s) =>
                                          s.id === student.id
                                            ? { ...s, selected: e.target.checked }
                                            : s
                                        )
                                      );
                                    }}
                                    className="h-4 w-4"
                                  />
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {student.firstName} {student.lastName}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500">
                                  {maskTc(student.tcKimlikNo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                        <button
                          onClick={() => {
                            setShowStudentSelector(false);
                            setAvailableStudents([]);
                            setSelectedGroupIds([]);
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          İptal
                        </button>
                        <button
                          onClick={handleAddSelectedStudents}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Seçilenleri Ekle ({availableStudents.filter((s) => s.selected).length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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

