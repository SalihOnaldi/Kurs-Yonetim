"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface InstructorSummaryItem {
  id: number;
  fullName: string;
  username: string;
  email: string;
  isActive: boolean;
  totalMinutes: number;
  totalHours: number;
  overLimit: boolean;
}

interface InstructorSummaryResponse {
  weekStart: string;
  weekEnd: string;
  limitMinutes: number;
  limitHours: number;
  instructors: InstructorSummaryItem[];
}

interface InstructorSlot {
  id: number;
  startTime: string;
  endTime: string;
  subject?: string | null;
  notes?: string | null;
  classroomName?: string | null;
  mebGroupId: number;
  durationMinutes: number;
  groupInfo: {
    id: number;
    srcType: number;
    year: number;
    month: number;
    groupNo: number;
    branch?: string | null;
  };
}

interface InstructorWeeklyDetail {
  instructor: {
    id: number;
    fullName: string;
    username: string;
    email: string;
    isActive: boolean;
  };
  weekStart: string;
  weekEnd: string;
  limitMinutes: number;
  limitHours: number;
  totalMinutes: number;
  totalHours: number;
  overLimit: boolean;
  slots: InstructorSlot[];
}

interface InstructorCreateResponse {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: string;
}

const MAX_WEEKLY_MINUTES = 40 * 60;
const CREATE_FORM_INITIAL = {
  fullName: "",
  username: "",
  email: "",
  password: "",
  role: "Egitmen",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatTimeRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const minutesToHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

export default function InstructorsPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<InstructorSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [detail, setDetail] = useState<InstructorWeeklyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({ ...CREATE_FORM_INITIAL });

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
        setLoading(false);
      })
      .catch(() => router.push("/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, weekOffset]);

  useEffect(() => {
    if (!authorized || selectedInstructorId === null) return;
    loadInstructorDetail(selectedInstructorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, selectedInstructorId, weekOffset]);

  const computeReferenceDate = () => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  };

  const openCreateInstructorModal = () => {
    setCreateForm({ ...CREATE_FORM_INITIAL });
    setCreateError("");
    setCreateSuccess("");
    setCreateModalOpen(true);
  };

  const closeCreateInstructorModal = () => {
    if (createSubmitting) return;
    setCreateModalOpen(false);
    setCreateError("");
    setCreateSuccess("");
  };

  const handleCreateFormChange =
    (field: keyof typeof CREATE_FORM_INITIAL) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setCreateForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleCreateInstructorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!createForm.fullName.trim() || !createForm.username.trim() || !createForm.password.trim()) {
      setCreateError("Ad soyad, kullanıcı adı ve şifre alanları zorunludur.");
      return;
    }

    setCreateSubmitting(true);

    try {
      const payload = {
        fullName: createForm.fullName.trim(),
        username: createForm.username.trim(),
        email: createForm.email.trim() || undefined,
        password: createForm.password,
        role: createForm.role,
      };

      const response = await api.post<InstructorCreateResponse>("/instructors", payload);
      setCreateSuccess("Eğitmen başarıyla oluşturuldu.");
      await loadSummary();
      setCreateForm({ ...CREATE_FORM_INITIAL });

      if (response.data?.id) {
        setSelectedInstructorId(response.data.id);
        await loadInstructorDetail(response.data.id);
      }

      setTimeout(() => {
        setCreateSubmitting(false);
        setCreateModalOpen(false);
      }, 600);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Eğitmen oluşturulurken bir hata oluştu. Lütfen bilgileri kontrol edin.";
      setCreateError(message);
      setCreateSubmitting(false);
    }
  };

  const loadSummary = async () => {
    try {
      setSummaryLoading(true);
      setSummaryError("");
      const referenceDate = computeReferenceDate().toISOString();
      const response = await api.get<InstructorSummaryResponse>(
        `/schedule/instructor-summary?referenceDate=${encodeURIComponent(referenceDate)}`
      );
      setSummary(response.data);

      const instructorIds = response.data.instructors.map((item) => item.id);
      if (instructorIds.length === 0) {
        setSelectedInstructorId(null);
        setDetail(null);
      } else if (!selectedInstructorId || !instructorIds.includes(selectedInstructorId)) {
        setSelectedInstructorId(instructorIds[0]);
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Eğitmen listesi yüklenirken bir hata oluştu.";
      setSummaryError(message);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadInstructorDetail = async (instructorId: number) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      const referenceDate = computeReferenceDate().toISOString();
      const response = await api.get<InstructorWeeklyDetail>(
        `/schedule/instructors/${instructorId}/weekly?referenceDate=${encodeURIComponent(
          referenceDate
        )}`
      );
      setDetail(response.data);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Eğitmen detayları yüklenirken bir hata oluştu.";
      setDetailError(message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const weekRangeLabel = useMemo(() => {
    if (!summary) return "";
    return `${formatDate(summary.weekStart)} - ${formatDate(summary.weekEnd)}`;
  }, [summary]);

  const groupedSlots = useMemo(() => {
    if (!detail?.slots) return [];
    const map = new Map<string, { date: Date; slots: InstructorSlot[] }>();
    detail.slots.forEach((slot) => {
      const date = new Date(slot.startTime);
      const key = date.toDateString();
      if (!map.has(key)) {
        map.set(key, { date, slots: [] });
      }
      map.get(key)!.slots.push(slot);
    });
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [detail]);

  const renderInstructorCard = (item: InstructorSummaryItem) => {
    const isSelected = selectedInstructorId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setSelectedInstructorId(item.id)}
        className={`w-full text-left border rounded-xl p-4 transition ${
          isSelected
            ? "border-indigo-500 bg-indigo-50 shadow-md"
            : "border-gray-200 bg-white hover:border-indigo-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">🧑‍🏫</span>
              {item.fullName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{item.email || item.username}</p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              item.overLimit ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {minutesToHours(item.totalMinutes)} saat
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full ${
              item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {item.isActive ? "Aktif" : "Pasif"}
          </span>
          {item.overLimit && (
            <span className="px-2 py-1 rounded-full bg-red-50 text-red-700">
              {minutesToHours(MAX_WEEKLY_MINUTES)} saat sınırı aşıldı
            </span>
          )}
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Eğitmen verileri yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50">
      <nav className="bg-white shadow-lg border-b-2 border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:py-0 md:h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/menu")}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← Ana Menü
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">🧑‍🏫</span>
                Eğitmenler
              </h1>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <div className="text-sm text-gray-500 max-w-md">
                Eğitmen ekleyin, haftalık ders dağılımlarını ve 40 saatlik MEB sınırını kolayca takip edin.
              </div>
              <button
                onClick={openCreateInstructorModal}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 transition-colors"
              >
                + Eğitmen Ekle
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-6">
        <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Haftalık Özet</h2>
              <p className="text-sm text-gray-600">
                Her eğitmenin planlanan ders saatlerini ve 40 saatlik MEB sınırına yaklaşanları
                görüntüleyin.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="px-3 py-2 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-sm font-medium"
              >
                ‹ Önceki Hafta
              </button>
              <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold min-w-[180px] text-center">
                {summaryLoading ? "Yükleniyor..." : weekRangeLabel}
              </div>
              <button
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="px-3 py-2 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-sm font-medium"
              >
                Sonraki Hafta ›
              </button>
            </div>
          </div>
          {summaryError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {summaryError}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Eğitmenler</h3>
              {summaryLoading ? (
                <div className="text-sm text-gray-500">Eğitmen listesi yükleniyor...</div>
              ) : summary && summary.instructors.length > 0 ? (
                <div className="space-y-3">
                  {summary.instructors.map((item) => renderInstructorCard(item))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Bu hafta için ataması yapılmış eğitmen bulunmuyor.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {detail?.instructor?.fullName || "Eğitmen seçin"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Toplam:{" "}
                    <span
                      className={`font-semibold ${
                        detail?.overLimit ? "text-red-600" : "text-indigo-600"
                      }`}
                    >
                      {detail ? minutesToHours(detail.totalMinutes) : 0} saat
                    </span>{" "}
                    / {minutesToHours(MAX_WEEKLY_MINUTES)} saat
                  </p>
                </div>
                {detail?.overLimit && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold">
                    Bu eğitmen haftalık {minutesToHours(MAX_WEEKLY_MINUTES)} saat sınırını aşmış durumda. Yeni ders eklerken dikkat edin.
                  </div>
                )}
              </div>

              {detailError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {detailError}
                </div>
              )}

              {detailLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">Program yükleniyor...</div>
              ) : !detail ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Gösterilecek ders programı bulunamadı.
                </div>
              ) : detail.slots.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Bu hafta için ders planlanmamış.
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {groupedSlots.map(({ date, slots }) => (
                    <div key={date.toISOString()} className="border border-gray-200 rounded-xl">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-800">
                          {date.toLocaleDateString("tr-TR", {
                            weekday: "long",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {minutesToHours(
                            slots.reduce((acc, slot) => acc + (slot.durationMinutes || 0), 0)
                          )}{" "}
                          saat
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {slots.map((slot) => (
                          <div
                            key={slot.id}
                            className="px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                          >
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {slot.subject || "Ders"}{" "}
                                <span className="text-gray-500 font-normal">
                                  • {formatTimeRange(slot.startTime, slot.endTime)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                                  SRC{slot.group?.srcType}
                                </span>
                                {slot.group && (
                                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                                    {slot.group.year}-{String(slot.group.month).padStart(
                                      2,
                                      "0"
                                    )}
                                    -GRUP {slot.group.groupNo}
                                    {slot.group.branch ? ` (${slot.group.branch})` : ""}
                                  </span>
                                )}
                                {slot.classroomName && (
                                  <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg">
                                    Derslik: {slot.classroomName}
                                  </span>
                                )}
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">
                                  {minutesToHours(slot.durationMinutes)} saat
                                </span>
                              </div>
                              {slot.notes && (
                                <p className="text-xs text-gray-500 mt-2">{slot.notes}</p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                router.push(`/courses/${slot.mebGroupId}?tab=schedule&slot=${slot.id}`)
                              }
                              className="self-start md:self-center px-3 py-2 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-xs font-medium"
                            >
                              Kurs Detayını Aç
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-indigo-900">Yeni Eğitmen Oluştur</h2>
              <button
                type="button"
                onClick={closeCreateInstructorModal}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                disabled={createSubmitting}
              >
                Kapat ✕
              </button>
            </div>
            <form onSubmit={handleCreateInstructorSubmit} className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    value={createForm.fullName}
                    onChange={handleCreateFormChange("fullName")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Örnek: Mehmet Yılmaz"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={handleCreateFormChange("username")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="egitmen01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">E-posta</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={handleCreateFormChange("email")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="opsiyonel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Rol</label>
                  <select
                    value={createForm.role}
                    onChange={handleCreateFormChange("role")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Egitmen">Eğitmen</option>
                    <option value="EgitimYoneticisi">Eğitim Yöneticisi</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Şifre</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={handleCreateFormChange("password")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Minimum 6 karakter"
                    required
                  />
                </div>
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
                  {createSuccess}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateInstructorModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                  disabled={createSubmitting}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 disabled:opacity-70"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? "Kaydediliyor..." : "Eğitmeni Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

