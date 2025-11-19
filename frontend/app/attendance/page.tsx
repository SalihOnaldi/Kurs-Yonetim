"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface AttendanceRecord {
  id: number;
  studentInfo: {
    id: number;
    tcKimlikNo: string;
    firstName: string;
    lastName: string;
  };
  scheduleSlotInfo: {
    id: number;
    startTime: string;
    endTime: string;
    subject?: string | null;
    courseInfo: {
      id: number;
      srcType: number;
    };
  };
  isPresent: boolean;
  excuse?: string | null;
  markedAt?: string | null;
  createdAt: string;
}

export default function AttendancePage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [listError, setListError] = useState("");

  const [courseFilter, setCourseFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [presentFilter, setPresentFilter] = useState<"all" | "present" | "absent">("all");
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
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, courseFilter, studentFilter, dateFilter, presentFilter]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setListError("");

      const params = new URLSearchParams();
      if (courseFilter.trim()) params.append("courseId", courseFilter.trim());
      if (studentFilter.trim()) params.append("studentId", studentFilter.trim());
      if (dateFilter) {
        const startDate = new Date(dateFilter);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateFilter);
        endDate.setHours(23, 59, 59, 999);
        params.append("startDate", startDate.toISOString());
        params.append("endDate", endDate.toISOString());
      }
      if (presentFilter !== "all") params.append("isPresent", presentFilter === "present" ? "true" : "false");

      const response = await api.get<AttendanceRecord[]>(
        `/attendance${params.size ? `?${params.toString()}` : ""}`
      );
      setAttendance(response.data || []);
    } catch (err: any) {
      console.error("Attendance load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Yoklama kayıtları yüklenirken bir hata oluştu.";
      setListError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const maskTc = (tc: string) => {
    if (tc.length !== 11) return tc;
    return `${tc.slice(0, 3)}***${tc.slice(6)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Yoklama kayıtları yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50">
      <nav className="bg-white shadow-lg border-b-2 border-teal-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-teal-600 hover:text-teal-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">✅</span>
                Yoklama Yönetimi
              </h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => router.push("/attendance/check-in")}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow hover:from-teal-700 hover:to-emerald-700"
              >
                🤖 Yapay Zekâ Check-in
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Filtreler</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="md:hidden px-3 py-1 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Göster"}
              </button>
            </div>
            <div
              className={`${filtersOpen ? "grid mt-4" : "hidden"} md:grid grid-cols-1 md:grid-cols-5 gap-4`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kurs ID</label>
                <input
                  type="text"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kursiyer ID
                </label>
                <input
                  type="text"
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tarih
                </label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Durum
                </label>
                <select
                  value={presentFilter}
                  onChange={(e) => setPresentFilter(e.target.value as "all" | "present" | "absent")}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">Tümü</option>
                  <option value="present">Katılan</option>
                  <option value="absent">Katılmayan</option>
                </select>
              </div>
            </div>
            {listError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {listError}
              </div>
            )}
            {!filtersOpen && (
              <div className="text-xs text-gray-500 md:hidden">
                Filtre alanını görmek için butonu kullanın.
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
            {attendance.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Bu kriterlere uygun yoklama kaydı bulunamadı.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {attendance.map((record) => (
                  <div
                    key={record.id}
                    className="px-6 py-4 hover:bg-teal-50 transition-colors duration-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {record.studentInfo.firstName} {record.studentInfo.lastName}
                          </h3>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              record.isPresent
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {record.isPresent ? "Katıldı" : "Katılmadı"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Kurs:</span> SRC
                            {record.scheduleSlotInfo.courseInfo.srcType}
                          </div>
                          <div>
                            <span className="font-medium">Ders:</span>{" "}
                            {record.scheduleSlotInfo.subject || "Program"}
                          </div>
                          <div>
                            <span className="font-medium">Başlangıç:</span>{" "}
                            {formatDateTime(record.scheduleSlotInfo.startTime)}
                          </div>
                          <div>
                            <span className="font-medium">Yoklama:</span>{" "}
                            {record.markedAt ? formatDateTime(record.markedAt) : "-"}
                          </div>
                        </div>
                        {record.excuse && (
                          <div className="mt-2 text-sm text-gray-500">
                            <span className="font-medium">Mazeret:</span> {record.excuse}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Kursiyer TC: {maskTc(record.studentInfo.tcKimlikNo)}
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

