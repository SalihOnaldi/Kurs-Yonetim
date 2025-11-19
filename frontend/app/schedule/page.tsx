"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface ScheduleSlot {
  id: number;
  startTime: string;
  endTime: string;
  subject?: string | null;
  classroomName?: string | null;
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
  instructorInfo?: {
    id: number;
    fullName: string;
  } | null;
  attendanceCount: number;
  createdAt: string;
}

export default function SchedulePage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [listError, setListError] = useState("");

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [instructorFilter, setInstructorFilter] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    loadSchedule(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    loadSchedule(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, courseFilter, branchFilter, instructorFilter]);

  const loadSchedule = async (initial: boolean) => {
    try {
      if (initial) setLoading(true);
      else setFetching(true);

      setListError("");
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
      params.append("startDate", startDate.toISOString());
      params.append("endDate", endDate.toISOString());
      if (courseFilter.trim()) params.append("courseId", courseFilter.trim());
      if (branchFilter.trim()) params.append("branch", branchFilter.trim());
      if (instructorFilter.trim()) params.append("instructorId", instructorFilter.trim());

      const response = await api.get<ScheduleSlot[]>(
        `/schedule${params.size ? `?${params.toString()}` : ""}`
      );
      setSlots(response.data || []);
    } catch (err: any) {
      console.error("Schedule load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Ders programı yüklenirken bir hata oluştu.";
      setListError(message);
    } finally {
      if (initial) setLoading(false);
      setFetching(false);
    }
  };

  const branches = useMemo(() => {
    const unique = new Set<string>();
    slots.forEach((slot) => {
      if (slot.courseInfo.groupInfo.branch) unique.add(slot.courseInfo.groupInfo.branch);
    });
    return Array.from(unique).sort();
  }, [slots]);

  const instructors = useMemo(() => {
    const unique = new Map<number, string>();
    slots.forEach((slot) => {
      if (slot.instructorInfo) unique.set(slot.instructorInfo.id, slot.instructorInfo.fullName);
    });
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [slots]);

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Ders programı yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50">
      <nav className="bg-white shadow-lg border-b-2 border-indigo-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📅</span>
                Ders Programı
              </h1>
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
                className="md:hidden px-3 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Göster"}
              </button>
            </div>
            <div
              className={`${filtersOpen ? "grid mt-4" : "hidden"} md:grid grid-cols-1 md:grid-cols-5 gap-4`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tarih
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kurs ID
                </label>
                <input
                  type="text"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Şube
                </label>
                <input
                  list="branch-options"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="branch-options">
                  {branches.map((branch) => (
                    <option key={branch} value={branch} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Eğitmen ID
                </label>
                <input
                  type="text"
                  value={instructorFilter}
                  onChange={(e) => setInstructorFilter(e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-end justify-end">
                {instructors.length > 0 && (
                  <span className="text-xs text-gray-500">
                    Eğitmen Idleri:{" "}
                    {instructors.map(([id, name]) => `${id} - ${name}`).join(", ")}
                  </span>
                )}
              </div>
            </div>
            {listError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {listError}
              </div>
            )}
            {fetching && (
              <div className="text-sm text-indigo-600 animate-pulse">
                Ders programı güncelleniyor...
              </div>
            )}
            {!filtersOpen && (
              <div className="text-xs text-gray-500 md:hidden">
                Filtre alanını görmek için butonu kullanın.
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
            {slots.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-gray-500 text-lg font-medium">
                  Bu kriterlere uygun ders programı bulunamadı.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {slots.map((slot) => (
                  <div key={slot.id} className="px-6 py-4 hover:bg-indigo-50 transition-colors duration-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {slot.subject || "Ders"} • SRC{slot.courseInfo.srcType} •{" "}
                            {slot.courseInfo.groupInfo.year}-{slot.courseInfo.groupInfo.month}-GRUP{" "}
                            {slot.courseInfo.groupInfo.groupNo}
                            {slot.courseInfo.groupInfo.branch
                              ? ` (${slot.courseInfo.groupInfo.branch})`
                              : ""}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Başlangıç:</span>{" "}
                            {formatDateTime(slot.startTime)}
                          </div>
                          <div>
                            <span className="font-medium">Bitiş:</span>{" "}
                            {formatDateTime(slot.endTime)}
                          </div>
                          <div>
                            <span className="font-medium">Sınıf:</span>{" "}
                            {slot.classroomName || "-"}
                          </div>
                          <div>
                            <span className="font-medium">Eğitmen:</span>{" "}
                            {slot.instructorInfo ? slot.instructorInfo.fullName : "-"}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          <span className="font-medium">Yoklama Sayısı:</span>{" "}
                          {slot.attendanceCount}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
