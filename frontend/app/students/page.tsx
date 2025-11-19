"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type ActiveFilter = "all" | "active" | "inactive";

interface StudentListItem {
  id: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  branchName?: string;
  lastCourseName?: string;
  hasActiveCourse: boolean;
  lastEnrollmentDate?: string;
}

interface CreateStudentForm {
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  educationLevel?: string;
  licenseType?: string;
  licenseIssueDate?: string;
}

const initialForm: CreateStudentForm = {
  tcKimlikNo: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  educationLevel: "",
  licenseType: "",
};

export default function StudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [listError, setListError] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [branchInput, setBranchInput] = useState("");
  const [activeFilterInput, setActiveFilterInput] = useState<ActiveFilter>("all");
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    active: "all" as ActiveFilter,
  });

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<CreateStudentForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);

  const hasLoadedRef = useRef(false);

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
  }, [router]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    loadStudents(true).finally(() => {
      hasLoadedRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized || !hasLoadedRef.current) {
      return;
    }
    loadStudents(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, filters]);

  const loadStudents = async (initial = false) => {
    try {
      setListError("");
      if (initial) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }

      const params = new URLSearchParams();
      if (filters.search.trim()) {
        params.append("search", filters.search.trim());
      }
      if (filters.branch.trim()) {
        params.append("branch", filters.branch.trim());
      }
      if (filters.active === "active") {
        params.append("hasActiveCourse", "true");
      } else if (filters.active === "inactive") {
        params.append("hasActiveCourse", "false");
      }

      const qs = params.toString();
      const response = await api.get<StudentListItem[]>(qs ? `/students?${qs}` : "/students");
      setStudents(response.data || []);
    } catch (error: any) {
      console.error("Students load error:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Kursiyer listesi yüklenirken bir hata oluştu";
      setListError(message);
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsFetching(false);
      }
    }
  };

  const branchOptions = useMemo(() => {
    const unique = new Set<string>();
    students.forEach((student) => {
      if (student.branchName) {
        unique.add(student.branchName);
      }
    });
    return Array.from(unique).sort();
  }, [students]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const resetFormState = () => {
    setFormData(initialForm);
    setFormError("");
    setSubmitting(false);
    setEditingStudentId(null);
  };

  const handleCreateModal = () => {
    resetFormState();
    setShowModal(true);
  };

  const handleEdit = (student: StudentListItem) => {
    setFormData({
      tcKimlikNo: student.tcKimlikNo,
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone,
      email: student.email,
      address: "",
      educationLevel: "",
      licenseType: "",
    });
    setEditingStudentId(student.id);
    setFormError("");
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    resetFormState();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const payload: any = {
        tcKimlikNo: formData.tcKimlikNo,
        firstName: formData.firstName,
        lastName: formData.lastName,
      };

      if (formData.birthDate) {
        const date = new Date(formData.birthDate);
        if (!Number.isNaN(date.getTime())) {
          payload.birthDate = date.toISOString();
        }
      }
      if (formData.phone?.trim()) payload.phone = formData.phone.trim();
      if (formData.email?.trim()) payload.email = formData.email.trim();
      if (formData.address?.trim()) payload.address = formData.address.trim();
      if (formData.educationLevel?.trim()) payload.educationLevel = formData.educationLevel.trim();
      if (formData.licenseType?.trim()) payload.licenseType = formData.licenseType.trim();
      if (formData.licenseIssueDate) {
        const licenseDate = new Date(formData.licenseIssueDate);
        if (!Number.isNaN(licenseDate.getTime())) {
          payload.licenseIssueDate = licenseDate.toISOString();
        }
      }

      if (editingStudentId) {
        await api.put(`/students/${editingStudentId}`, payload);
      } else {
        await api.post("/students", payload);
      }

      handleModalClose();
      loadStudents(true);
    } catch (error: any) {
      console.error("Student save error:", error);
      const message =
        error.response?.data?.message ||
        error.response?.data?.title ||
        error.message ||
        "Kursiyer kaydedilirken bir hata oluştu";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (student: StudentListItem) => {
    if (
      !confirm(
        `${student.firstName} ${student.lastName} kursiyerini silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/students/${student.id}`);
      loadStudents(true);
    } catch (error: any) {
      const message =
        error.response?.data?.message || error.message || "Kursiyer silinirken bir hata oluştu";
      alert(message);
    }
  };

  const handleViewDetail = (studentId: number) => {
    router.push(`/students/${studentId}`);
  };

  const applyFilters = () => {
    setFilters({
      search: searchInput,
      branch: branchInput,
      active: activeFilterInput,
    });
  };

  const resetFilters = () => {
    setSearchInput("");
    setBranchInput("");
    setActiveFilterInput("all");
    setFilters({
      search: "",
      branch: "",
      active: "all",
    });
  };

  const maskTc = (tc: string) => {
    if (tc.length !== 11) return tc;
    return `${tc.slice(0, 3)}***${tc.slice(6)}`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString("tr-TR");
    } catch {
      return iso;
    }
  };

  const renderActiveBadge = (hasActiveCourse: boolean) => {
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${
          hasActiveCourse ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
        }`}
      >
        {hasActiveCourse ? "Aktif Kursu Var" : "Pasif"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <nav className="bg-white shadow-lg border-b-2 border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">👥</span>
                Kursiyer Yönetimi
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Kursiyerler</h2>
              <p className="text-sm text-gray-500 mt-1">
                Kursiyerleri filtreleyin, yeni kayıt oluşturun ve detay sayfasına geçiş yapın.
              </p>
            </div>
            <button
              onClick={handleCreateModal}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              + Yeni Kursiyer
            </button>
          </div>

          <section className="bg-white shadow-xl border border-gray-100 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h3 className="text-sm font-semibold text-gray-900 md:text-base">Filtreler</h3>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="md:hidden px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Göster"}
              </button>
            </div>
            <div
              className={`${filtersOpen ? "mt-4 grid" : "hidden"} md:grid grid-cols-1 md:grid-cols-4 gap-4`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Arama
                </label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="TC, ad, soyad..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Şube
                </label>
                <input
                  list="branch-options"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  placeholder="Şube adı..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <datalist id="branch-options">
                  {branchOptions.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Aktif Kurs Durumu
                </label>
                <select
                  value={activeFilterInput}
                  onChange={(e) => setActiveFilterInput(e.target.value as ActiveFilter)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tümü</option>
                  <option value="active">Aktif Kursu Olanlar</option>
                  <option value="inactive">Pasif Kursiyerler</option>
                </select>
              </div>
              <div className="flex items-end justify-end gap-2">
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 border-2 border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Temizle
                </button>
                <button
                  onClick={applyFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Filtrele
                </button>
              </div>
            </div>
            {isFetching && (
              <div className="mt-4 text-sm text-blue-600 flex items-center gap-2">
                <span className="inline-block h-3 w-3 bg-blue-500 rounded-full animate-spin" />
                Liste güncelleniyor...
              </div>
            )}
            {listError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {listError}
              </div>
            )}
            {!filtersOpen && (
              <div className="mt-2 text-xs text-gray-500 md:hidden">
                Filtreleri görüntülemek için butonu kullanın.
              </div>
            )}
          </section>

          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-100">
            {students.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-gray-500 text-lg font-medium">
                  Henüz kursiyer kaydı bulunmamaktadır.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Yeni kursiyer eklemek için yukarıdaki butonu kullanın.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Kursiyer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Şube
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Son Kurs
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Durum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Son Kayıt
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {maskTc(student.tcKimlikNo)}
                          </div>
                          {(student.phone || student.email) && (
                            <div className="text-xs text-gray-500 mt-1">
                              {student.phone && <span className="mr-2">📞 {student.phone}</span>}
                              {student.email && <span>✉️ {student.email}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {student.branchName || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {student.lastCourseName || "-"}
                        </td>
                        <td className="px-6 py-4">{renderActiveBadge(student.hasActiveCourse)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(student.lastEnrollmentDate)}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleViewDetail(student.id)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                              Detay
                            </button>
                            <button
                              onClick={() => handleEdit(student)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleDelete(student)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Yeni / Düzenle Kursiyer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">
                {editingStudentId ? "Kursiyer Bilgilerini Güncelle" : "Yeni Kursiyer Ekle"}
              </h3>
              <button
                onClick={handleModalClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TC Kimlik No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={formData.tcKimlikNo}
                    onChange={(e) => setFormData({ ...formData, tcKimlikNo: e.target.value })}
                    disabled={!!editingStudentId}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="12345678901"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Soyad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Soyad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doğum Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate || ""}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0555 123 45 67"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ornek@email.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adres
                  </label>
                  <textarea
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Adres bilgisi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Eğitim Seviyesi
                  </label>
                  <select
                    value={formData.educationLevel || ""}
                    onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seçiniz</option>
                    <option value="İlkokul">İlkokul</option>
                    <option value="Ortaokul">Ortaokul</option>
                    <option value="Lise">Lise</option>
                    <option value="Ön Lisans">Ön Lisans</option>
                    <option value="Lisans">Lisans</option>
                    <option value="Yüksek Lisans">Yüksek Lisans</option>
                    <option value="Doktora">Doktora</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ehliyet Tipi
                  </label>
                  <select
                    value={formData.licenseType || ""}
                    onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seçiniz</option>
                    <option value="M">M (Moped)</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="A">A</option>
                    <option value="B1">B1</option>
                    <option value="B">B</option>
                    <option value="C1">C1</option>
                    <option value="C">C</option>
                    <option value="D1">D1</option>
                    <option value="D">D</option>
                    <option value="BE">BE</option>
                    <option value="CE">CE</option>
                    <option value="DE">DE</option>
                    <option value="F">F (Traktör)</option>
                    <option value="G">G (İş Makinesi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ehliyet Veriliş Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.licenseIssueDate || ""}
                    onChange={(e) => setFormData({ ...formData, licenseIssueDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Kaydediliyor...
                    </span>
                  ) : (
                    "Kaydet"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

