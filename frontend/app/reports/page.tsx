"use client";

import { useState } from "react";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

type ReportType =
  | "lesson_schedule"
  | "attendance"
  | "exam_results"
  | "certificates"
  | "payments";

type ReportFormat = "json" | "csv" | "html" | "pdf" | "doc" | "xls";

interface ReportResponse<T = any> {
  reportType: string;
  format: string;
  generatedAt: string;
  meta: any;
  data: T;
}

const reportOptions: { value: ReportType; label: string; description: string }[] = [
  {
    value: "lesson_schedule",
    label: "Ders Programı",
    description: "Seçilen kursun ders programı slotlarını listeler.",
  },
  {
    value: "attendance",
    label: "Yoklama Listesi",
    description: "Seçilen kursun yoklama kayıtlarını döner.",
  },
  {
    value: "exam_results",
    label: "Sınav Sonuçları",
    description: "Seçilen sınavın aday bazlı sonuçlarını içerir.",
  },
  {
    value: "certificates",
    label: "Sertifika Listesi",
    description: "Seçilen kurs için sertifika almaya hak kazanan adayları listeler.",
  },
  {
    value: "payments",
    label: "Ödeme Listesi",
    description: "Seçilen kurs veya kursiyer için ödeme kayıtlarını getirir.",
  },
];

const formatOptions: { value: ReportFormat; label: string }[] = [
  { value: "json", label: "JSON (önizleme)" },
  { value: "csv", label: "CSV" },
  { value: "html", label: "HTML" },
  { value: "pdf", label: "PDF" },
  { value: "doc", label: "Word (DOC)" },
  { value: "xls", label: "Excel (XLS)" },
];

export default function ReportsPage() {
  const router = useRouter();

  const [reportType, setReportType] = useState<ReportType>("lesson_schedule");
  const [mebGroupId, setMebGroupId] = useState("");
  const [examId, setExamId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [format, setFormat] = useState<ReportFormat>("json");
  const [successMessage, setSuccessMessage] = useState("");

  const handleGenerate = async () => {
    setError("");
    setSuccessMessage("");

    setResult(null);

    const parameters: Record<string, string> = {};
    if (reportType === "lesson_schedule" || reportType === "attendance" || reportType === "certificates") {
      if (!mebGroupId.trim()) {
        setError("Lütfen sınıf ID girin.");
        return;
      }
      parameters.mebGroupId = mebGroupId.trim();
    }
    if (reportType === "exam_results") {
      if (!examId.trim()) {
        setError("Lütfen sınav ID girin.");
        return;
      }
      parameters.examId = examId.trim();
    }
    if (reportType === "payments") {
      if (mebGroupId.trim()) parameters.mebGroupId = mebGroupId.trim();
      if (studentId.trim()) parameters.studentId = studentId.trim();
      if (!mebGroupId.trim() && !studentId.trim()) {
        setError("Ödeme raporu için sınıf ID veya kursiyer ID girin.");
        return;
      }
    }

    try {
      setLoading(true);
      if (format === "json") {
        const response = await api.post<ReportResponse>("/reports/generate", {
          reportType,
          format,
          parameters,
        });
        setResult(response.data);
        setSuccessMessage("JSON raporu hazırlandı.");
        return;
      }

      const response = await api.post(
        "/reports/generate",
        {
          reportType,
          format,
          parameters,
        },
        {
          responseType: "blob",
        }
      );

      const contentType = response.headers["content-type"] ?? "application/octet-stream";
      const blob =
        response.data instanceof Blob ? response.data : new Blob([response.data], { type: contentType });
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "");
      const extension = format === "doc" ? "doc" : format === "xls" ? "xls" : format;
      const filename = `${reportType}-${timestamp}.${extension}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMessage(`Rapor indirildi: ${filename}`);
    } catch (error: any) {
      console.error("Report generate error:", error);
      const axiosError = error as AxiosError;
      if (axiosError.response?.data instanceof Blob) {
        try {
          const text = await axiosError.response.data.text();
          const parsed = JSON.parse(text);
          setError(parsed.message || parsed.title || "Rapor oluşturulurken bir hata oluştu.");
          return;
        } catch {
          setError(axiosError.message || "Rapor oluşturulurken bir hata oluştu.");
          return;
        }
      }

      const message =
        (axiosError.response?.data as any)?.message ||
        axiosError.message ||
        "Rapor oluşturulurken bir hata oluştu.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.reportType}-report.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <nav className="bg-white shadow-lg border-b-2 border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-slate-600 hover:text-slate-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📊</span>
                Rapor Merkezi
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Rapor Seçimi</h2>
            <div className="grid grid-cols-1 gap-3">
              {reportOptions.map((option) => (
                <label
                  key={option.value}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    reportType === option.value
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-blue-200"
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      className="mt-1 mr-3"
                      checked={reportType === option.value}
                      onChange={() => setReportType(option.value)}
                    />
                    <div>
                      <div className="font-semibold text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Parametreler</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="md:hidden px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                {filtersOpen ? "Alanı Gizle" : "Alanı Göster"}
              </button>
            </div>
            <div
              className={`${filtersOpen ? "mt-4 space-y-4" : "hidden"} md:mt-4 md:space-y-4 md:block`}
            >
              {reportType !== "payments" && reportType !== "exam_results" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kurs ID</label>
                  <input
                    type="text"
                    value={mebGroupId}
                    onChange={(e) => setMebGroupId(e.target.value)}
                    placeholder="Örn: 101"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {reportType === "exam_results" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sınav ID</label>
                  <input
                    type="text"
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                    placeholder="Örn: 205"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {reportType === "payments" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kurs ID</label>
                    <input
                      type="text"
                      value={mebGroupId}
                      onChange={(e) => setMebGroupId(e.target.value)}
                      placeholder="Opsiyonel"
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kursiyer ID
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="Opsiyonel"
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Çıktı Formatı</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ReportFormat)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {formatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  JSON seçeneğinde rapor sayfada önizlenir, diğer formatlar doğrudan indirilir.
                </p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Rapor oluşturuluyor..." : "Raporu Oluştur"}
              </button>
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {successMessage}
                </div>
              )}
            </div>
            {!filtersOpen && (
              <div className="text-xs text-gray-500 md:hidden">
                Parametre alanını görüntülemek için butonu kullanın.
              </div>
            )}
          </section>

          {result && (
            <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Rapor Sonucu</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(result.generatedAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <button
                  onClick={downloadJson}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  JSON indir
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Meta</h3>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto text-xs text-gray-800">
                  {JSON.stringify(result.meta, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Veri</h3>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto text-xs text-gray-800 max-h-[400px]">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

