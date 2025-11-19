"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PhotoCapture from "@/components/attendance/PhotoCapture";
import GpsConsent from "@/components/attendance/GpsConsent";

interface StudentSearchResult {
  id: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}

interface ScheduleOption {
  id: number;
  courseInfo: {
    id: number;
    srcType: number;
    groupInfo: {
      year: number;
      month: number;
      groupNo: number;
    };
  };
  subject?: string | null;
  startTime: string;
  endTime: string;
}

export default function AttendanceCheckInPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [photoData, setPhotoData] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null
  );
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        loadScheduleOptions();
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScheduleOptions = async () => {
    try {
      setScheduleLoading(true);
      setSubmitError("");
      const now = new Date();
      const end = new Date(now.getTime() + 3 * 60 * 60 * 1000); // next 3 hours
      const response = await api.get<ScheduleOption[]>(
        `/schedule?startDate=${now.toISOString()}&endDate=${end.toISOString()}`
      );
      setScheduleOptions(response.data || []);
    } catch (err: any) {
      console.error("Schedule load error:", err);
      setSubmitError(
        err.response?.data?.message || err.message || "Ders programı bilgileri alınamadı."
      );
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleStudentSearch = async () => {
    const term = studentQuery.trim();
    if (!term) {
      setSubmitError("Kursiyer aramak için ad, soyad veya TCKN girin.");
      return;
    }

    try {
      setStudentLoading(true);
      setSubmitError("");
      const response = await api.get<StudentSearchResult[]>(
        `/students?search=${encodeURIComponent(term)}`
      );
      setStudentResults(response.data || []);
    } catch (err: any) {
      console.error("Student search error:", err);
      setSubmitError(
        err.response?.data?.message ||
          err.message ||
          "Kursiyer araması sırasında bir hata oluştu."
      );
    } finally {
      setStudentLoading(false);
    }
  };

  const formattedScheduleOptions = useMemo(() => {
    return scheduleOptions.map((option) => {
      const start = new Date(option.startTime);
      const end = new Date(option.endTime);
      return {
        ...option,
        label: `#${option.id} • ${start.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • SRC${
          option.courseInfo.srcType
        } ${option.courseInfo.groupInfo.year}-${option.courseInfo.groupInfo.month
          .toString()
          .padStart(2, "0")} GRUP ${option.courseInfo.groupInfo.groupNo} • ${
          option.subject || "Ders"
        }`,
      };
    });
  }, [scheduleOptions]);

  const handleSubmit = async () => {
    if (!selectedStudent) {
      setSubmitError("Lütfen bir kursiyer seçin.");
      return;
    }
    if (!selectedSlotId) {
      setSubmitError("Lütfen bir ders seçin.");
      return;
    }
    if (!photoData) {
      setSubmitError("Lütfen fotoğraf çekin.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      setSuccessMessage("");

      await api.post("/attendance/check-in", {
        studentId: selectedStudent.id,
        scheduleSlotId: selectedSlotId,
        photoBase64: photoData,
        gpsLat: location?.lat,
        gpsLng: location?.lng,
        gpsAccuracy: location?.accuracy,
      });

      setSuccessMessage("Yoklama kaydı başarıyla oluşturuldu.");
      setPhotoData("");
      setLocation(null);
    } catch (err: any) {
      console.error("Check-in error:", err);
      setSubmitError(
        err.response?.data?.message ||
          err.message ||
          "Yoklama kaydı yapılırken bir hata oluştu."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Yoklama giriş ekranı hazırlanıyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-100">
      <nav className="bg-white/90 backdrop-blur border-b border-teal-100 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push("/attendance")}
              className="text-teal-600 hover:text-teal-800 font-medium"
            >
              ← Yoklama Yönetimi
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-teal-900 flex items-center gap-2">
              <span className="text-3xl">🤖</span>
              Yapay Zekâ Destekli Yoklama
            </h1>
            <button
              onClick={loadScheduleOptions}
              className="text-sm text-teal-600 hover:text-teal-800"
            >
              Dersleri Yenile
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <section className="lg:col-span-3 space-y-6">
            <div className="bg-white/90 backdrop-blur border border-teal-100 rounded-2xl shadow-xl p-6 space-y-4">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-teal-900 flex items-center gap-2">
                  <span className="text-2xl">1️⃣</span>
                  Kursiyer ve Ders Bilgileri
                </h2>
                <p className="text-sm text-teal-700">
                  Yüz doğrulaması için kursiyer seçin ve yoklama alınacak dersi belirleyin.
                </p>
              </header>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Kursiyer Arama
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(event) => setStudentQuery(event.target.value)}
                      placeholder="Ad, soyad veya TCKN"
                      className="flex-1 px-4 py-2 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={handleStudentSearch}
                      disabled={studentLoading || !studentQuery.trim()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-60"
                    >
                      {studentLoading ? "Aranıyor..." : "Ara"}
                    </button>
                  </div>
                </label>

                {studentResults.length > 0 && (
                  <div className="border border-dashed border-teal-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {studentResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setStudentResults([]);
                          setStudentQuery("");
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-teal-50"
                      >
                        <div className="font-semibold text-teal-900">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-xs text-teal-600">
                          {student.tcKimlikNo} • {student.email || "-"} • {student.phone || "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedStudent && (
                  <div className="px-4 py-3 bg-teal-50 border border-teal-100 rounded-xl text-sm text-teal-900">
                    <div className="font-semibold">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </div>
                    <div className="text-xs text-teal-700">
                      {selectedStudent.email || "E-posta yok"} • {selectedStudent.phone || "Telefon yok"}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Ders Seçimi
                  <select
                    value={selectedSlotId ?? ""}
                    onChange={(event) =>
                      setSelectedSlotId(event.target.value ? Number(event.target.value) : null)
                    }
                    className="mt-2 w-full px-4 py-2 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Yaklaşan derslerden seçin</option>
                    {formattedScheduleOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {scheduleLoading && (
                  <div className="text-xs text-teal-600">Ders programı yükleniyor...</div>
                )}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur border border-teal-100 rounded-2xl shadow-xl p-6 space-y-4">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-teal-900 flex items-center gap-2">
                  <span className="text-2xl">2️⃣</span>
                  Fotoğraf ve Konum
                </h2>
                <p className="text-sm text-teal-700">
                  Yüz doğrulaması için fotoğraf çekin ve GPS konumunuzu paylaşın.
                </p>
              </header>

              <PhotoCapture onCapture={setPhotoData} />
              <GpsConsent onLocation={setLocation} />
            </div>
          </section>

          <aside className="lg:col-span-2 space-y-6">
            <div className="bg-white/90 backdrop-blur border border-teal-100 rounded-2xl shadow-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-teal-900 flex items-center gap-2">
                <span className="text-2xl">3️⃣</span>
                Yoklamayı Tamamla
              </h2>
              <p className="text-sm text-teal-700">
                Sistem, fotoğrafı yapay zekâ ile doğrulayarak kaydı tamamlayacaktır. Öğrencinin ilk
                kaydı ise otomatik olarak yüz profili oluşturulur.
              </p>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {submitError}
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
                  {successMessage}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full px-5 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:from-teal-700 hover:to-emerald-700 disabled:opacity-60"
              >
                {submitting ? "Yoklama Kaydediliyor..." : "Yoklamayı Kaydet"}
              </button>

              <div className="text-xs text-teal-600 bg-teal-50 border border-teal-100 px-3 py-2 rounded-lg">
                Konum paylaşımı önerilir ancak zorunlu değildir. Fotoğraf doğrulaması başarısız olursa
                tekrar fotoğraf çekmeniz istenir.
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}


