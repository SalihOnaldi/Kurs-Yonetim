"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type ApprovalStatus = "all" | "draft" | "pending" | "approved" | "rejected";

interface CourseListItem {
  id: number;
  name: string;
  srcType: number;
  srcTypeName: string;
  mebGroupId?: number;
  branchName: string;
  mebGroupName: string;
  startDate: string;
  endDate: string;
  plannedHours: number;
  isMixed: boolean;
  capacity: number;
  enrolledCount: number;
  mebApprovalStatus: string;
  createdAt: string;
}

interface CourseListResponse {
  items: CourseListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

interface ClassSummary {
  id: number;
  year: number;
  month: number;
  groupNo: number;
  branch?: string | null;
  startDate: string;
  endDate: string;
  capacity: number;
  status: string;
  courseCount: number;
  activeCourseCount: number;
  name: string;
}

interface ClassFormData {
  year: number;
  month: number;
  groupNo: number;
  branch: string;
  startDate: string;
  endDate: string;
  capacity: number;
}

const MONTH_OPTIONS = [
  { value: 1, label: "Ocak" },
  { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },
  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" },
  { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

const initialClassForm: ClassFormData = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  groupNo: 1,
  branch: "",
  startDate: "",
  endDate: "",
  capacity: 30,
};

type ManageModalMode = "createCourse" | "editClass";

const SRC_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "SRC1" },
  { value: 2, label: "SRC2" },
  { value: 3, label: "SRC3" },
  { value: 4, label: "SRC4" },
  { value: 5, label: "SRC5" },
];

export default function CoursesPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [listError, setListError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const [srcTypeFilter, setSrcTypeFilter] = useState<string>("all");
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<ApprovalStatus>("all");
  const [branchFilter, setBranchFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageModalMode, setManageModalMode] = useState<ManageModalMode>("createCourse");
  const [formData, setFormData] = useState({
    mebGroupId: 0,
    srcType: 1,
    isMixed: false,
    plannedHours: 40,
  });
  const [selectedMixedSrcTypes, setSelectedMixedSrcTypes] = useState<number[]>([]);
  const [formError, setFormError] = useState("");
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classListError, setClassListError] = useState("");
  const [editingClass, setEditingClass] = useState<ClassSummary | null>(null);
  const [classForm, setClassForm] = useState<ClassFormData & { status?: string }>(initialClassForm);
  const [classFormError, setClassFormError] = useState("");
  const [classSubmitting, setClassSubmitting] = useState(false);
  const [useExistingClass, setUseExistingClass] = useState(false);
  const [newClassForm, setNewClassForm] = useState<ClassFormData>(initialClassForm);

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
      })
      .catch(() => {
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadCourses(true);
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    loadCourses(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, srcTypeFilter, approvalStatusFilter, branchFilter, monthFilter, searchFilter]);

  const loadCourses = async (initial: boolean) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setFetching(true);
      }
      setListError("");

      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());
      if (srcTypeFilter !== "all") params.append("srcType", srcTypeFilter);
      if (approvalStatusFilter !== "all") params.append("mebApprovalStatus", approvalStatusFilter);
      if (branchFilter.trim()) params.append("branchId", branchFilter.trim());
      if (monthFilter) params.append("month", monthFilter);
      if (searchFilter.trim()) params.append("search", searchFilter.trim());

      const response = await api.get<CourseListResponse>(
        `/courses${params.size ? `?${params.toString()}` : ""}`
      );
      setCourses(response.data.items || []);
      setTotalCount(response.data.totalCount || 0);
    } catch (err: any) {
      console.error("Courses load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Kurs listesi yüklenirken bir hata oluştu.";
      setListError(message);
    } finally {
      if (initial) setLoading(false);
      setFetching(false);
    }
  };

  const loadClasses = async () => {
    try {
      setClassListError("");
      const response = await api.get<ClassSummary[]>("/courses/groups");
      const data = response.data || [];
      const filtered = data.filter(
        (item) => !item.status || item.status.toLowerCase() !== "inactive"
      );
      setClasses(filtered);
      if (useExistingClass) {
        setFormData((prev) => {
          if (prev.mebGroupId && filtered.some((item) => item.id === prev.mebGroupId)) {
            return prev;
          }
          return {
            ...prev,
            mebGroupId: filtered.length ? filtered[0].id : 0,
          };
        });
      }
    } catch (err: any) {
      console.error("Class list load error:", err);
      const message =
        err.response?.data?.message || err.message || "Sınıflar yüklenirken bir hata oluştu.";
      setClassListError(message);
      setClasses([]);
      if (useExistingClass) {
        setFormData((prev) => ({ ...prev, mebGroupId: 0 }));
      }
    }
  };

  const branchOptions = useMemo(() => {
    const unique = new Set<string>();
    courses.forEach((course) => {
      if (course.branchName) unique.add(course.branchName);
    });
    return Array.from(unique).sort();
  }, [courses]);

  const approvalText = (status: string) => {
    switch (status) {
      case "draft":
        return "Taslak";
      case "pending":
        return "Onay Bekliyor";
      case "approved":
        return "Onaylı";
      case "rejected":
        return "Reddedildi";
      default:
        return status;
    }
  };

  const approvalBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("tr-TR");
    } catch {
      return iso;
    }
  };

  useEffect(() => {
    if (!formData.isMixed) return;
    setSelectedMixedSrcTypes((prev) => {
      if (prev.includes(formData.srcType)) return prev;
      return [...prev, formData.srcType].sort((a, b) => a - b);
    });
  }, [formData.srcType, formData.isMixed]);

  const handleCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSubmittingCourse(true);

    try {
      if (formData.isMixed) {
        if (selectedMixedSrcTypes.length < 2) {
          setFormError("Karma sınıflarda en az iki SRC türü seçmelisiniz.");
          setSubmittingCourse(false);
          return;
        }
      }

      let payload: Record<string, unknown> = {
        srcType: formData.isMixed
          ? (selectedMixedSrcTypes[0] ?? formData.srcType)
          : formData.srcType,
        isMixed: formData.isMixed,
        mixedTypes: formData.isMixed
          ? selectedMixedSrcTypes
              .map((value) => SRC_OPTIONS.find((option) => option.value === value)?.label ?? `SRC${value}`)
              .join(",")
          : null,
        plannedHours: formData.plannedHours,
      };

      if (useExistingClass) {
        if (!formData.mebGroupId) {
          setFormError("Lütfen bir sınıf seçin veya oluşturun.");
          setSubmittingCourse(false);
          return;
        }
        payload = { ...payload, mebGroupId: formData.mebGroupId };
      } else {
        if (!newClassForm.startDate || !newClassForm.endDate) {
          setFormError("Başlangıç ve bitiş tarihleri gereklidir.");
          setSubmittingCourse(false);
          return;
        }

        if (new Date(newClassForm.startDate) >= new Date(newClassForm.endDate)) {
          setFormError("Bitiş tarihi başlangıç tarihinden büyük olmalıdır.");
          setSubmittingCourse(false);
          return;
        }

        if (newClassForm.capacity <= 0) {
          setFormError("Kontenjan en az 1 olmalıdır.");
          setSubmittingCourse(false);
          return;
        }

        const normalizedBranch = (newClassForm.branch || "").trim().toLowerCase();
        const existingMatch = classes.find(
          (item) =>
            item.year === newClassForm.year &&
            item.month === newClassForm.month &&
            item.groupNo === newClassForm.groupNo &&
            ((item.branch || "").trim().toLowerCase() === normalizedBranch)
        );

        if (existingMatch) {
          setFormError(
            `${existingMatch.name} zaten mevcut. Lütfen "Mevcut sınıfı seç" seçeneğini kullanarak bu sınıfı tercih edin.`
          );
          setUseExistingClass(true);
          setFormData((prev) => ({ ...prev, mebGroupId: existingMatch.id }));
          setSubmittingCourse(false);
          return;
        }

        payload = {
          ...payload,
          groupYear: newClassForm.year,
          groupMonth: newClassForm.month,
          groupNo: newClassForm.groupNo,
          groupStartDate: newClassForm.startDate,
          groupEndDate: newClassForm.endDate,
          groupBranch: newClassForm.branch.trim() || undefined,
          groupCapacity: newClassForm.capacity,
        };
      }

      const response = await api.post("/courses", payload);
      const createdCourse = response.data;
      closeManageModal();
      setFormData({
        mebGroupId: classes.length ? classes[0].id : 0,
        srcType: 1,
        isMixed: false,
        plannedHours: 40,
      });
      setSelectedMixedSrcTypes([]);
      if (!useExistingClass) {
        setNewClassForm(initialClassForm);
        setUseExistingClass(true);
        await loadClasses();
        if (createdCourse?.mebGroupId) {
          setFormData((prev) => ({ ...prev, mebGroupId: createdCourse.mebGroupId }));
        }
      } else {
        await loadClasses();
      }
      await loadCourses(true);
    } catch (err: any) {
      console.error("Course create error:", err);
      const message =
        err.response?.data?.message || err.message || "Kurs oluşturulurken bir hata oluştu.";
      setFormError(message);
    } finally {
      setSubmittingCourse(false);
    }
  };

  const openEditClassModal = (classData: ClassSummary) => {
    setManageModalMode("editClass");
    setEditingClass(classData);
    setClassForm({
      year: classData.year,
      month: classData.month,
      groupNo: classData.groupNo,
      branch: classData.branch ?? "",
      startDate: classData.startDate ? classData.startDate.slice(0, 10) : "",
      endDate: classData.endDate ? classData.endDate.slice(0, 10) : "",
      capacity: classData.capacity,
      status: classData.status,
    });
    setClassFormError("");
    setCreateModalOpen(true);
  };

  const handleEditClassFromCourse = (course: CourseListItem) => {
    if (!classes.length) {
      alert("Sınıf listesi yüklenemedi. Lütfen sayfayı yenileyin.");
      return;
    }

    let target = course.mebGroupId
      ? classes.find((item) => item.id === course.mebGroupId)
      : undefined;

    if (!target) {
      target = classes.find((item) => item.name === course.mebGroupName);
    }

    if (!target) {
      alert("İlgili sınıf bulunamadı. Lütfen sınıf listesini yenileyin veya yeniden oluşturun.");
      return;
    }

    openEditClassModal(target);
  };

  const openCourseModal = () => {
    setManageModalMode("createCourse");
    setFormError("");
    setClassFormError("");
    setSelectedMixedSrcTypes([]);
    setEditingClass(null);
    setClassForm({ ...initialClassForm });
    const hasClasses = classes.length > 0;
    setFormData({
      mebGroupId: hasClasses ? classes[0].id : 0,
      srcType: 1,
      isMixed: false,
      plannedHours: 40,
    });
    setUseExistingClass(hasClasses);
    setNewClassForm({ ...initialClassForm });
    setCreateModalOpen(true);
  };

  const closeManageModal = () => {
    setCreateModalOpen(false);
    setFormError("");
    setClassFormError("");
    setEditingClass(null);
    setManageModalMode("createCourse");
    setClassForm({ ...initialClassForm });
  };

  const handleClassSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClassFormError("");

    if (!classForm.startDate || !classForm.endDate) {
      setClassFormError("Başlangıç ve bitiş tarihleri gereklidir.");
      return;
    }

    if (new Date(classForm.startDate) >= new Date(classForm.endDate)) {
      setClassFormError("Bitiş tarihi başlangıç tarihinden büyük olmalıdır.");
      return;
    }

    if (classForm.capacity <= 0) {
      setClassFormError("Kontenjan en az 1 olmalıdır.");
      return;
    }

    if (!editingClass) {
      setClassFormError("Düzenlenecek sınıf bulunamadı.");
      return;
    }

    try {
      setClassSubmitting(true);
      if (manageModalMode === "editClass") {
        await api.put(`/courses/groups/${editingClass.id}`, {
          year: classForm.year,
          month: classForm.month,
          groupNo: classForm.groupNo,
          branch: classForm.branch.trim() || undefined,
          startDate: classForm.startDate,
          endDate: classForm.endDate,
          capacity: classForm.capacity,
          status: classForm.status,
        });
        await loadClasses();
      }

      closeManageModal();
    } catch (err: any) {
      console.error("Class create error:", err);
      const message =
        err.response?.data?.message || err.message || "Sınıf kaydedilirken bir hata oluştu.";
      setClassFormError(message);
    } finally {
      setClassSubmitting(false);
    }
  };

  const handleDeleteCourse = async (course: CourseListItem) => {
    if (!confirm(`${course.name} kursunu silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      await api.delete(`/courses/${course.id}`);
      loadCourses(true);
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Kurs silinirken bir hata oluştu.";
      alert(message);
    }
  };

  const handleToggleClassStatus = async (classItem: ClassSummary) => {
    try {
      if (classItem.status === "inactive") {
        await api.put(`/courses/groups/${classItem.id}`, { status: "active" });
      } else {
        if (!confirm(`${classItem.name} sınıfını pasif hale getirmek istiyor musunuz?`)) {
          return;
        }
        await api.delete(`/courses/groups/${classItem.id}`);
      }
      await loadClasses();
      closeManageModal();
      await loadCourses(false);
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Sınıf durumu güncellenirken hata oluştu.";
      alert(message);
    }
  };

  const handleDeleteClass = async (classItem: ClassSummary) => {
    if (!confirm(`${classItem.name} sınıfını kalıcı olarak silmek istiyor musunuz?`)) {
      return;
    }
    try {
      await api.delete(`/courses/groups/${classItem.id}?soft=false`);
      await loadClasses();
      closeManageModal();
      await loadCourses(false);
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Sınıf silinirken bir hata oluştu.";
      alert(message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Kurs listesi yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <nav className="bg-white shadow-lg border-b-2 border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <button
                onClick={() => router.push("/menu")}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                Genel Menü
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📚</span>
                Kurs Yönetimi
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="bg-white border border-emerald-100 shadow-xl rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-gray-900">Kurs ve Sınıf Yönetimi</h2>
                <p className="text-sm text-gray-600 max-w-2xl">
                  Tüm kurs ve sınıf süreçlerini tek akışta yönetin. Mevcut sınıfları seçin, yeni sınıflar
                  oluşturun ve kurs planlamasını aynı yerden tamamlayın.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  onClick={openCourseModal}
                  className="inline-flex items-center justify-center px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg shadow-lg hover:from-emerald-700 hover:to-green-700 font-medium transition-transform transform hover:scale-[1.02]"
                >
                  + Yeni Kurs / Sınıf
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className="sm:hidden px-4 py-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm font-medium"
                >
                  {filtersOpen ? "Filtre Alanını Gizle" : "Filtre Alanını Göster"}
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h3 className="text-sm font-semibold text-gray-900 md:text-base">Filtreler</h3>
            </div>
            <div
              className={`${filtersOpen ? "mt-4 grid" : "hidden"} md:grid grid-cols-1 md:grid-cols-5 gap-4`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  SRC Türü
                </label>
                <select
                  value={srcTypeFilter}
                  onChange={(e) => setSrcTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  MEB Onay Durumu
                </label>
                <select
                  value={approvalStatusFilter}
                  onChange={(e) => setApprovalStatusFilter(e.target.value as ApprovalStatus)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Tümü</option>
                  <option value="draft">Taslak</option>
                  <option value="pending">Onay Bekliyor</option>
                  <option value="approved">Onaylı</option>
                  <option value="rejected">Reddedildi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Şube
                </label>
                <input
                  list="branch-options"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  placeholder="Şube adı..."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <datalist id="branch-options">
                  {branchOptions.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ay / Dönem
                </label>
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Arama
                </label>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => {
                    setSearchFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Kurs adı, grup adı..."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                Toplam <span className="font-semibold text-gray-700">{totalCount}</span> kurs listeleniyor.
                {fetching && (
                  <span className="ml-2 text-green-600 animate-pulse">Güncelleniyor...</span>
                )}
              </div>
            </div>
            {listError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {listError}
            </div>
            )}
            {!filtersOpen && (
              <div className="mt-2 text-xs text-gray-500 md:hidden">
                Filtre alanını görmek için butonu kullanın.
          </div>
            )}
          </section>

          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-100">
            {courses.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-500 text-lg font-medium">
                  Filtre kriterlerine uygun kurs bulunamadı.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Filtreleri değiştirerek tekrar deneyin veya yeni kurs oluşturun.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Kurs
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Grup / Şube
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Tarih
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Kontenjan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Onay Durumu
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          İşlemler
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {courses.map((course) => (
                          <tr key={course.id} className="hover:bg-green-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-base font-semibold text-indigo-700">
                                {course.name}
                            </div>
                            <div className="text-sm text-gray-500">SRC{course.srcType}</div>
                            </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <div>{course.mebGroupName}</div>
                            <div className="text-xs text-gray-500">{course.branchName}</div>
                            </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <div>{formatDate(course.startDate)}</div>
                            <div className="text-xs text-gray-500">{formatDate(course.endDate)}</div>
                            </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                              {course.enrolledCount} / {course.capacity}
                            </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${approvalBadge(
                                course.mebApprovalStatus
                              )}`}
                            >
                              {approvalText(course.mebApprovalStatus)}
                              </span>
                            </td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleEditClassFromCourse(course)}
                              className="text-emerald-600 hover:text-emerald-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                            >
                              Sınıfı Düzenle
                            </button>
                              <button
                              onClick={() => router.push(`/courses/${course.id}`)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                                    >
                              Detay
                                    </button>
                                    <button
                              onClick={() => router.push(`/courses/${course.id}#schedule`)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                              Ders Programı
                                    </button>
                            <button
                              onClick={() => router.push(`/courses/${course.id}#students`)}
                              className="text-teal-600 hover:text-teal-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-teal-50 transition-colors"
                            >
                              Öğrenci Ekle
                            </button>
                                    <button
                              onClick={() => handleDeleteCourse(course)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                              Sil
                                    </button>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <span>Sayfa</span>
                    <strong>
                      {page} / {totalPages}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Önceki
                    </button>
                    <button
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Sonraki
                    </button>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(parseInt(e.target.value));
                        setPage(1);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
 
        </div>

      </main>

      {createModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full ${
              manageModalMode === "createCourse" ? "max-w-4xl" : "max-w-2xl"
            }`}
          >
            <div className="sticky top-0 bg-white border-b border-emerald-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-emerald-900">
                {manageModalMode === "createCourse" ? "Kurs ve Sınıf Oluştur" : "Sınıfı Düzenle"}
              </h3>
              <button
                onClick={closeManageModal}
                className="text-emerald-400 hover:text-emerald-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {manageModalMode === "createCourse" ? (
              <form onSubmit={handleCreateCourse} className="p-6 space-y-6">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <section className="space-y-4">
                  <header>
                    <h4 className="text-lg font-semibold text-emerald-800">Sınıf Bilgileri</h4>
                    <p className="text-sm text-emerald-600">
                      Mevcut bir sınıfı seçebilir veya kursla birlikte yeni bir sınıf oluşturabilirsiniz.
                    </p>
                  </header>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUseExistingClass(true);
                        setFormError("");
                        if (classes.length) {
                          setFormData((prev) => ({ ...prev, mebGroupId: classes[0].id }));
                        }
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
                        useExistingClass
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      Mevcut sınıfı seç
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseExistingClass(false);
                        setFormData((prev) => ({ ...prev, mebGroupId: 0 }));
                        setNewClassForm(initialClassForm);
                        setFormError("");
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
                        !useExistingClass
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      Yeni sınıf oluştur
                    </button>
                  </div>

                  {classListError && (
                    <p className="text-sm text-red-600">{classListError}</p>
                  )}

                  {useExistingClass ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <select
                        value={formData.mebGroupId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mebGroupId: (() => {
                              const next = Number(e.target.value);
                              return Number.isNaN(next) ? 0 : next;
                            })(),
                          })
                        }
                        disabled={classes.length === 0}
                        className="flex-1 px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        {classes.length === 0 ? (
                          <option value={0}>Önce bir sınıf oluşturun</option>
                        ) : (
                          classes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} • {item.capacity} kişi
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setUseExistingClass(false);
                          setNewClassForm(initialClassForm);
                          setFormData((prev) => ({ ...prev, mebGroupId: 0 }));
                          setFormError("");
                        }}
                        className="px-4 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm font-medium"
                      >
                        Sınıf Bilgisi Gir
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Yıl</label>
                        <input
                          type="number"
                          min={2020}
                          value={newClassForm.year}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({ ...prev, year: parseInt(e.target.value) || prev.year }))
                          }
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ay</label>
                        <select
                          value={newClassForm.month}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({ ...prev, month: parseInt(e.target.value) || prev.month }))
                          }
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        >
                          {MONTH_OPTIONS.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sınıf No</label>
                        <input
                          type="number"
                          min={1}
                          value={newClassForm.groupNo}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({ ...prev, groupNo: parseInt(e.target.value) || prev.groupNo }))
                          }
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Şube</label>
                        <input
                          type="text"
                          value={newClassForm.branch}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({ ...prev, branch: e.target.value }))
                          }
                          placeholder="Merkez / Şube adı"
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Tarihi</label>
                        <input
                          type="date"
                          value={newClassForm.startDate}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({ ...prev, startDate: e.target.value }))
                          }
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Tarihi</label>
                        <input
                          type="date"
                          value={newClassForm.endDate}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({ ...prev, endDate: e.target.value }))
                          }
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Kontenjan</label>
                        <input
                          type="number"
                          min={1}
                          value={newClassForm.capacity}
                          onChange={(e) =>
                            setNewClassForm((prev) => ({
                              ...prev,
                              capacity: parseInt(e.target.value) || prev.capacity,
                            }))
                          }
                          className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <header>
                    <h4 className="text-lg font-semibold text-emerald-800">Kurs Bilgileri</h4>
                    <p className="text-sm text-emerald-600">Kurs türünü, saatini ve varsayılan ayarları seçin.</p>
                  </header>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SRC Türü <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.srcType}
                      onChange={(e) => setFormData({ ...formData, srcType: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      {SRC_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Planlanan Saat <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.plannedHours}
                      onChange={(e) => setFormData({ ...formData, plannedHours: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id="isMixed"
                      type="checkbox"
                      checked={formData.isMixed}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setFormData({ ...formData, isMixed: next });
                        if (next) {
                          setSelectedMixedSrcTypes((prev) => {
                            const withPrimary = prev.includes(formData.srcType)
                              ? prev
                              : [...prev, formData.srcType];
                            return withPrimary.sort((a, b) => a - b);
                          });
                        } else {
                          setSelectedMixedSrcTypes([]);
                        }
                      }}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-emerald-300 rounded"
                    />
                    <label htmlFor="isMixed" className="text-sm text-gray-700">
                      Karma sınıf (Birden fazla SRC türü içerir)
                    </label>
                  </div>

                  {formData.isMixed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Karma SRC Türleri</label>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">
                          Birden fazla seçebilirsiniz. İlk seçilen tür ana kurs türü olarak kaydedilir.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SRC_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition ${
                                selectedMixedSrcTypes.includes(option.value)
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : "border-emerald-100 hover:border-emerald-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500"
                                checked={selectedMixedSrcTypes.includes(option.value)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedMixedSrcTypes((prev) => {
                                    if (checked) {
                                      if (prev.includes(option.value)) return prev;
                                      return [...prev, option.value].sort((a, b) => a - b);
                                    }
                                    return prev.filter((value) => value !== option.value);
                                  });
                                }}
                              />
                              <span className="text-sm font-medium">{option.label}</span>
                            </label>
                          ))}
                        </div>
                        {selectedMixedSrcTypes.length === 0 && (
                          <p className="text-xs text-red-600">En az bir SRC türü seçmelisiniz.</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                  <button
                    type="button"
                    onClick={closeManageModal}
                    className="px-5 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCourse}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 font-medium shadow-lg disabled:opacity-50"
                  >
                    {submittingCourse ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleClassSubmit} className="p-6 space-y-4">
                {classFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {classFormError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Yıl <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={2020}
                      value={classForm.year}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, year: parseInt(e.target.value) || prev.year }))
                      }
                      required
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ay <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={classForm.month}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, month: parseInt(e.target.value) || prev.month }))
                      }
                      className="w-full px-4 py-2 border-emerald-200 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sınıf No <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={classForm.groupNo}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, groupNo: parseInt(e.target.value) || prev.groupNo }))
                      }
                      required
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Şube</label>
                    <input
                      type="text"
                      value={classForm.branch}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, branch: e.target.value }))
                      }
                      placeholder="Merkez / Şube adı"
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Başlangıç Tarihi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={classForm.startDate}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                      required
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bitiş Tarihi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={classForm.endDate}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                      required
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kontenjan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={classForm.capacity}
                      onChange={(e) =>
                        setClassForm((prev) => ({ ...prev, capacity: parseInt(e.target.value) || prev.capacity }))
                      }
                      required
                      className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {manageModalMode === "editClass" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Durum</label>
                      <select
                        value={classForm.status ?? "draft"}
                        onChange={(e) =>
                          setClassForm((prev) => ({ ...prev, status: e.target.value }))
                        }
                        className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="draft">Taslak</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Pasif</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-emerald-100 sm:flex-row sm:items-center sm:justify-between">
                  {manageModalMode === "editClass" && editingClass && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleClassStatus(editingClass)}
                        className="px-4 py-2 border-2 border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 font-medium transition-colors"
                      >
                        {editingClass.status === "inactive" ? "Sınıfı Aktifleştir" : "Sınıfı Pasif Et"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(editingClass)}
                        className="px-4 py-2 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
                      >
                        Sınıfı Sil
                      </button>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 sm:ml-auto">
                    <button
                      type="button"
                      onClick={closeManageModal}
                      className="px-5 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={classSubmitting}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 font-medium shadow-lg disabled:opacity-50"
                    >
                      {classSubmitting ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
 
