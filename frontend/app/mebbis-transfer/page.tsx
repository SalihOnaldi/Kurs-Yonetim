"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface CourseOption {
  id: number;
  name: string;
}

interface TransferJob {
  id: number;
  courseId: number;
  mode: string;
  status: string;
  successCount: number;
  failureCount: number;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
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

interface TransferJobDetail extends TransferJob {
  items: TransferItem[] | null;
}

interface TransferItem {
  id: number;
  enrollmentId: number;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  transferredAt?: string | null;
  enrollment: {
    id: number;
    student: {
      firstName: string;
      lastName: string;
      tcKimlikNo: string;
    };
  };
}

export default function MebbisTransferPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<TransferJob[]>([]);
  const [listError, setListError] = useState("");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | "">("");
  const [pendingTransfer, setPendingTransfer] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [jobDetail, setJobDetail] = useState<TransferJobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

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

  useEffect(() => {
    if (!authorized) return;
    loadJobs();
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, selectedCourse]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setListError("");
      const params = selectedCourse ? `?courseId=${selectedCourse}` : "";
      const response = await api.get<TransferJob[]>(`/mebbis-transfer${params}`);
      setJobs(response.data || []);
    } catch (err: any) {
      console.error("MEBBIS jobs load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "MEBBİS aktarım geçmişi yüklenirken bir hata oluştu.";
      setListError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await api.get("/courses?page=1&pageSize=200");
      const data = Array.isArray(response.data)
        ? (response.data as any[])
        : ((response.data as any)?.items as any[] | undefined) || [];
      setCourses(
        data.map((course) => ({
          id: course.id,
          name: course.name || `SRC${course.srcType} - ${course.mebGroupName || ""}`,
        }))
      );
    } catch (err: any) {
      console.error("Course list load error:", err);
    }
  };

  const runTransfer = async (mode: "dry_run" | "live") => {
    if (!selectedCourse) {
      alert("Lütfen önce bir kurs seçiniz.");
      return;
    }

    const confirmMessage =
      mode === "dry_run"
        ? "Dry run MEBBİS aktarımı başlatmak istediğinize emin misiniz?"
        : "Canlı MEBBİS aktarımı başlatmak üzeresiniz. Devam edilsin mi?";
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setPendingTransfer(true);
      setTransferError("");
      await api.post(`/mebbis-transfer/${selectedCourse}?mode=${mode}`);
      await loadJobs();
      alert("Aktarım başlatıldı. Job listesi güncellendi.");
    } catch (err: any) {
      console.error("Run transfer error:", err);
      const message =
        err.response?.data?.message || err.message || "MEBBİS aktarımı başlatılırken hata oluştu.";
      setTransferError(message);
    } finally {
      setPendingTransfer(false);
    }
  };

  const loadJobDetail = async (jobId: number) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await api.get<TransferJobDetail>(`/mebbis-transfer/${jobId}`);
      setJobDetail(response.data);
    } catch (err: any) {
      console.error("Job detail error:", err);
      const message =
        err.response?.data?.message || err.message || "Aktarım detayları yüklenirken hata oluştu.";
      setDetailError(message);
    } finally {
      setDetailLoading(false);
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

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "running":
        return "bg-blue-100 text-blue-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">MEBBİS aktarım bilgileri yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <nav className="bg-white shadow-lg border-b-2 border-blue-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📤</span>
                MEBBİS Aktarım Merkezi
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Aktarım Başlat</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="md:hidden px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                {filtersOpen ? "Alanı Gizle" : "Alanı Göster"}
              </button>
            </div>
            <div
              className={`${filtersOpen ? "flex flex-col gap-4" : "hidden"} md:flex md:flex-row md:items-end md:gap-4`}
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kurs Seçin
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kurs seçiniz</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => runTransfer("dry_run")}
                  disabled={pendingTransfer}
                  className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  Dry Run
                </button>
                <button
                  onClick={() => runTransfer("live")}
                  disabled={pendingTransfer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Canlı Aktarım
                </button>
              </div>
            </div>
            {transferError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {transferError}
              </div>
            )}
            {!filtersOpen && (
              <div className="text-xs text-gray-500 md:hidden">
                Kurs seçimi ve aktarım seçeneklerini görmek için butonu kullanın.
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
            <header className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Aktarım Geçmişi</h2>
                <p className="text-sm text-gray-500">
                  Son başlatılan MEBBİS aktarım job'larını görüntüleyin ve detaylarını inceleyin.
                </p>
              </div>
            </header>
            {listError ? (
              <div className="px-6 py-10 text-center text-red-600">{listError}</div>
            ) : jobs.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Bu kriterlere uygun aktarım bulunamadı.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <div key={job.id} className="px-6 py-4 hover:bg-blue-50 transition-colors duration-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {job.mode === "live" ? "Canlı" : "Dry Run"} • SRC{job.course.srcType},{" "}
                            {job.course.group.year}-{job.course.group.month}-GRUP{" "}
                            {job.course.group.groupNo}
                            {job.course.group.branch ? ` (${job.course.group.branch})` : ""}
                          </h3>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadge(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Başlatma:</span>{" "}
                            {formatDateTime(job.startedAt)}
                          </div>
                          <div>
                            <span className="font-medium">Tamamlama:</span>{" "}
                            {job.completedAt ? formatDateTime(job.completedAt) : "-"}
                          </div>
                          <div>
                            <span className="font-medium">Sonuç:</span>{" "}
                            {job.successCount} başarılı / {job.failureCount} hatalı
                          </div>
                          <div>
                            <span className="font-medium">Log:</span>{" "}
                            {job.errorMessage ? job.errorMessage : "-"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadJobDetail(job.id)}
                          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Detay
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {detailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Aktarım Detayları</h3>
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  setJobDetail(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              {detailLoading ? (
                <div className="text-center text-gray-500">Detaylar yükleniyor...</div>
              ) : detailError ? (
                <div className="text-center text-red-600">{detailError}</div>
              ) : jobDetail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                    <DetailItem label="Kurs">
                      SRC{jobDetail.course.srcType} • {jobDetail.course.group.year}-
                      {jobDetail.course.group.month}-GRUP {jobDetail.course.group.groupNo}
                      {jobDetail.course.group.branch ? ` (${jobDetail.course.group.branch})` : ""}
                    </DetailItem>
                    <DetailItem label="Mod">
                      {jobDetail.mode === "live" ? "Canlı Aktarım" : "Dry Run"}
                    </DetailItem>
                    <DetailItem label="Durum">
                      {jobDetail.status}
                    </DetailItem>
                    <DetailItem label="Başlatma">
                      {formatDateTime(jobDetail.startedAt)}
                    </DetailItem>
                    <DetailItem label="Tamamlama">
                      {jobDetail.completedAt ? formatDateTime(jobDetail.completedAt) : "-"}
                    </DetailItem>
                    <DetailItem label="Sonuç">
                      {jobDetail.successCount} başarılı / {jobDetail.failureCount} hatalı
                    </DetailItem>
                  </div>
                  {jobDetail.errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {jobDetail.errorMessage}
                    </div>
                  )}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Kursiyer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Durum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Hata Kodu
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Mesaj
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tarih
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {jobDetail.items && jobDetail.items.length > 0 ? (
                          jobDetail.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                {item.enrollment.student.firstName} {item.enrollment.student.lastName}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                <span
                                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                    item.status === "transferred"
                                      ? "bg-green-100 text-green-700"
                                      : item.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                {item.errorCode || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                {item.errorMessage || "-"}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {item.transferredAt ? formatDateTime(item.transferredAt) : "-"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                              Bu job için aktarım kaydı bulunmuyor.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
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

