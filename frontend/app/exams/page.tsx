"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type ExamTypeFilter = "all" | "written" | "practical";
type ExamStatusFilter = "all" | "scheduled" | "completed" | "cancelled";

interface ExamListItem {
  id: number;
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
  resultCount: number;
  passCount: number;
  failCount: number;
  createdAt: string;
}

interface CourseListItem {
  id: number;
  name: string;
  srcType: number;
  branchName: string;
  mebGroupName: string;
}

type CoursesResponse = CourseListItem[] | { items: CourseListItem[] };

interface CreateExamForm {
  mebGroupId: number;
  examType: string;
  examDate: string;
  mebSessionCode?: string;
  notes?: string;
}

type ExamListResponse =
  | ExamListItem[]
  | {
      items: ExamListItem[];
      totalCount: number;
      page: number;
      pageSize: number;
    };

const PAGE_SIZE = 20;

const initialForm: CreateExamForm = {
  mebGroupId: 0,
  examType: "written",
  examDate: "",
  mebSessionCode: "",
  notes: "",
};

export default function ExamsPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [listError, setListError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);


  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [coursesError, setCoursesError] = useState("");

  const [srcTypeFilter, setSrcTypeFilter] = useState<string>("all");
  const [examTypeFilter, setExamTypeFilter] = useState<ExamTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>("all");
  const [branchFilter, setBranchFilter] = useState("");
  const [branchFilterInput, setBranchFilterInput] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateExamForm>(initialForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    loadExams(true);
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    loadExams(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, srcTypeFilter, examTypeFilter, statusFilter, branchFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const normalized = branchFilterInput.trim();
      if (normalized === branchFilter) return;
      setPage(1);
      setBranchFilter(normalized);
    }, 300);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilterInput]);

  const loadExams = async (initial: boolean) => {
    try {
      if (initial) setLoading(true);
      else setFetching(true);

      setListError("");
      const params = new URLSearchParams();
      if (srcTypeFilter !== "all") params.append("srcType", srcTypeFilter);
      if (examTypeFilter !== "all")
        params.append("examType", examTypeFilter === "written" ? "yazili" : "uygulama");
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (branchFilter.trim()) params.append("branch", branchFilter.trim());
      if (startDateFilter) params.append("startDate", new Date(startDateFilter).toISOString());
      if (endDateFilter) params.append("endDate", new Date(endDateFilter).toISOString());
      params.append("page", page.toString());
      params.append("pageSize", PAGE_SIZE.toString());

      const response = await api.get<ExamListResponse>(
        `/exams${params.size ? `?${params.toString()}` : ""}`
      );
      const raw = response.data;
      const items = Array.isArray(raw) ? raw : raw?.items ?? [];
      const total = Array.isArray(raw) ? items.length : raw?.totalCount ?? items.length;
      const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);
      if (!initial && total > 0 && page > totalPages) {
        setPage(totalPages);
        return;
      }
      if (!initial && total === 0 && page !== 1) {
        setPage(1);
        return;
      }
      setTotalCount(total);
      setExams(items);
    } catch (err: any) {
      console.error("Exams load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Sınav listesi yüklenirken bir hata oluştu.";
      setListError(message);
    } finally {
      if (initial) setLoading(false);
      setFetching(false);
    }
  };

  const loadCourses = async () => {
    try {
      setCoursesError("");
      const response = await api.get<CoursesResponse>("/courses/groups");
      const raw = response.data;
      const data = Array.isArray(raw) ? raw : raw?.items ?? [];
      setCourses(data);
      if (data.length) {
        setFormData((prev) => ({ ...prev, mebGroupId: prev.mebGroupId || data[0].id }));
      }
    } catch (err: any) {
      console.error("Courses for exam load error:", err);
      const message =
        err.response?.data?.message || "Kurs listesi yüklenirken bir hata oluştu.";
      setCoursesError(message);
    }
  };

  const branchOptions = useMemo(() => {
    const unique = new Set<string>();
    exams.forEach((exam) => {
      if (exam.groupInfo.branch) unique.add(exam.groupInfo.branch);
    });
    return Array.from(unique).sort();
  }, [exams]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("tr-TR");
    } catch {
      return iso;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const examTypeText = (type: string) =>
    type === "practical" || type === "uygulama" ? "Uygulama" : "Yazılı";

  const handleDelete = async (exam: ExamListItem) => {
    if (
      !confirm(
        `${examTypeText(exam.examType)} sınavını (${formatDate(
          exam.examDate
        )}) silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/exams/${exam.id}`);
      // Silme işleminden sonra sayfa numarasını kontrol et
      // Eğer son sayfada tek eleman varsa ve silindiyse, bir önceki sayfaya geç
      const currentPageItemCount = exams.length;
      if (currentPageItemCount === 1 && page > 1) {
        setPage(page - 1);
      } else {
        // Sayfa numarası değişmediyse, listeyi yeniden yükle
        loadExams(false);
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Sınav silinirken bir hata oluştu.";
      alert(message);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      await api.post("/exams", {
        mebGroupId: formData.mebGroupId,
        examType: formData.examType,
        examDate: new Date(formData.examDate).toISOString(),
        mebSessionCode: formData.mebSessionCode?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });

      setCreateModalOpen(false);
      setFormData(initialForm);
      loadExams(true);
    } catch (err: any) {
      console.error("Exam create error:", err);
      const message =
        err.response?.data?.message || err.message || "Sınav oluşturulurken bir hata oluştu.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Sınav listesi yükleniyor...</div>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const goToPrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
      <nav className="bg-white shadow-lg border-b-2 border-purple-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-purple-600 hover:text-purple-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📝</span>
                Sınav Yönetimi
              </h1>
            </div>
            <div className="hidden md:flex items-center">
              <button
                onClick={() => router.push("/exams/groups")}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow hover:from-purple-700 hover:to-pink-700 transition-colors"
              >
                Sınıf Bazlı Sonuçlar
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h3 className="text-sm font-semibold text-gray-900 md:text-base">Filtreler</h3>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="md:hidden px-3 py-1 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Göster"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/exams/groups")}
                className="md:hidden px-3 py-1 text-xs font-semibold text-white bg-purple-600 border border-purple-200 rounded-lg shadow hover:bg-purple-700"
              >
                Sınıf Bazlı Sonuçlar
              </button>
            </div>
            <div
              className={`${filtersOpen ? "grid mt-4" : "hidden"} md:grid grid-cols-1 md:grid-cols-6 gap-4`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  SRC Türü
                </label>
                <select
                  value={srcTypeFilter}
                  onChange={(e) => {
                    setPage(1);
                    setSrcTypeFilter(e.target.value);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tümü</option>
                  <option value="1">SRC1</option>
                  <option value="2">SRC2</option>
                  <option value="3">SRC3</option>
                  <option value="4">SRC4</option>
                  <option value="5">SRC5</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sınav Tipi
                </label>
                <select
                  value={examTypeFilter}
                  onChange={(e) => {
                    setPage(1);
                    setExamTypeFilter(e.target.value as ExamTypeFilter);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tümü</option>
                  <option value="written">Yazılı</option>
                  <option value="practical">Uygulama</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Durum
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1);
                    setStatusFilter(e.target.value as ExamStatusFilter);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Tümü</option>
                  <option value="scheduled">Planlandı</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Şube
                </label>
                <input
                  type="text"
                  placeholder="Şube filtresi"
                  value={branchFilterInput}
                  onChange={(e) => setBranchFilterInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <datalist id="branch-options">
                  {branchOptions.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Başlangıç
                </label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setPage(1);
                    setStartDateFilter(e.target.value);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bitiş
                </label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setPage(1);
                    setEndDateFilter(e.target.value);
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            {listError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {listError}
              </div>
            )}
            {!filtersOpen && (
              <div className="text-xs text-gray-500 md:hidden">
                Filtreleri görüntülemek için butonu kullanın.
              </div>
            )}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Toplam <span className="font-semibold text-gray-700">{exams.length}</span> sınav
                listeleniyor.
                {fetching && (
                  <span className="ml-2 text-purple-600 animate-pulse">Güncelleniyor...</span>
                )}
              </div>
            <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-medium shadow-lg transition-transform transform hover:scale-105"
            >
              + Yeni Sınav
            </button>
          </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
            {exams.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-6l mb-4">📝</div>
                <p className="text-gray-500 text-lg font-medium">
                  Filtre kriterlerine uygun sınav bulunamadı.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Filtreleri değiştirerek tekrar deneyin veya yeni sınav ekleyin.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="px-6 py-4 hover:bg-purple-50 transition-colors duration-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {examTypeText(exam.examType)} Sınavı • SRC{exam.groupInfo.srcType} •{" "}
                            {exam.groupInfo.year}-{exam.groupInfo.month}-GRUP{" "}
                            {exam.groupInfo.groupNo}
                            {exam.groupInfo.branch
                              ? ` (${exam.groupInfo.branch})`
                              : ""}
                          </h3>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadge(
                              exam.status
                            )}`}
                          >
                            {exam.status === "completed"
                              ? "Tamamlandı"
                              : exam.status === "scheduled"
                              ? "Planlandı"
                              : "İptal"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Sınav Tarihi:</span>{" "}
                            {formatDate(exam.examDate)}
                          </div>
                          <div>
                            <span className="font-medium">MEB Oturum Kodu:</span>{" "}
                            {exam.mebSessionCode || "-"}
                          </div>
                          <div>
                            <span className="font-medium">Sonuç:</span>{" "}
                            {exam.passCount}/{exam.resultCount} geçti
                          </div>
                          <div>
                            <span className="font-medium">Oluşturulma:</span>{" "}
                            {formatDate(exam.createdAt)}
                          </div>
                        </div>
                        {exam.notes && (
                          <div className="mt-2 text-sm text-gray-500">
                            <span className="font-medium">Not:</span> {exam.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => router.push(`/exams/${exam.id}`)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                          Detay / Sonuç
                        </button>
                        <button
                          onClick={() => handleDelete(exam)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Sil
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

      {createModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">Yeni Sınav Oluştur</h3>
              <button
                onClick={() => {
                  setCreateModalOpen(false);
                  setFormError("");
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {formError}
                </div>
              )}
              {coursesError && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
                  {coursesError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kurs <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.mebGroupId}
                  onChange={(e) =>
                    setFormData({ ...formData, mebGroupId: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={0}>Kurs Seçiniz</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sınav Tipi <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.examType}
                  onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="written">Yazılı Sınav</option>
                  <option value="practical">Uygulama Sınavı</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sınav Tarihi <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.examDate}
                  onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MEB Oturum Kodu
                </label>
                <input
                  type="text"
                  value={formData.mebSessionCode}
                  onChange={(e) => setFormData({ ...formData, mebSessionCode: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Opsiyonel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Sınav hakkında notlar..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-medium shadow-lg disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

