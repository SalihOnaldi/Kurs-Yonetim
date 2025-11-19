"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

type InstructorSummary = {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: string;
};

type ScheduleSlot = {
  id: number;
  courseId: number;
  instructorId?: number | null;
  instructor?: {
    id: number;
    fullName: string;
    username: string;
    email: string;
  } | null;
  classroomId?: number | null;
  classroomName?: string | null;
  startTime: string;
  endTime: string;
  subject?: string | null;
  notes?: string | null;
  durationMinutes?: number;
};

type CourseDetailResponse = {
  id: number;
  srcType: number;
  srcTypeName: string;
  plannedHours: number;
  group: {
    id: number;
    year: number;
    month: number;
    monthName: string;
    groupNo: number;
    branch?: string | null;
    startDate: string;
    endDate: string;
    capacity: number;
  };
};

type TabKey = "create" | "bulk";

const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // 07:00 - 20:00
const CELL_HEIGHT = 60;

const DAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const DAY_ABBR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];
const DAY_OPTIONS = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 0, label: "Pazar" },
];
const MAX_WEEKLY_MINUTES = 40 * 60;

const ensureTimeWithSeconds = (time: string) => (time.length === 5 ? `${time}:00` : time);
const buildLocalDateTime = (date: string, time: string) => `${date}T${ensureTimeWithSeconds(time)}`;
const parseLocalDateTime = (date: string, time: string) => new Date(buildLocalDateTime(date, time));
const toInputDate = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CourseSchedulerPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = Number(params.id);

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [instructors, setInstructors] = useState<InstructorSummary[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [instructorsError, setInstructorsError] = useState("");

  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("create");

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotModalMode, setSlotModalMode] = useState<"create" | "edit">("create");
  const [slotFormSubmitting, setSlotFormSubmitting] = useState(false);
  const [slotFormError, setSlotFormError] = useState("");
  const [slotFormSuccess, setSlotFormSuccess] = useState("");
  const [slotForm, setSlotForm] = useState({
    date: "",
    startTime: "09:00",
    endTime: "12:00",
    subject: "",
    classroomName: "",
    instructorId: "",
    notes: "",
  });
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [lastSlotTimes, setLastSlotTimes] = useState({ start: "09:00", end: "12:00" });

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFormSubmitting, setBulkFormSubmitting] = useState(false);
  const [bulkFormError, setBulkFormError] = useState("");
  const [bulkFormSuccess, setBulkFormSuccess] = useState("");
  const [bulkForm, setBulkForm] = useState({
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "12:00",
    subject: "",
    classroomName: "",
    instructorId: "",
    daysOfWeek: [] as number[],
  });

  useEffect(() => {
    if (!courseId || Number.isNaN(courseId)) {
      router.push("/courses");
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
  }, [courseId]);

  useEffect(() => {
    if (!authorized) return;
    loadCourse();
    loadSchedule();
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<CourseDetailResponse>(`/courses/${courseId}`);
      setCourse(response.data);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Kurs bilgileri yüklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const response = await api.get<ScheduleSlot[]>(`/schedule?courseId=${courseId}`);
      setSchedule(response.data || []);
    } catch (err) {
      console.error("Schedule load error:", err);
    }
  };

  const loadInstructors = async () => {
    try {
      setInstructorsLoading(true);
      setInstructorsError("");
      const response = await api.get<InstructorSummary[]>("/instructors");
      setInstructors(response.data || []);
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Eğitmen listesi yüklenirken hata oluştu.";
      setInstructorsError(message);
    } finally {
      setInstructorsLoading(false);
    }
  };

  const parseDateOrToday = (value?: string | null) => {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const startOfWeek = (date: Date) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (day + 6) % 7; // Monday start
    result.setDate(result.getDate() - diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const formatShortDate = (date: Date) =>
    date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });

  const baseScheduleDate = useMemo(() => {
    if (course?.group?.startDate) {
      return parseDateOrToday(course.group.startDate);
    }
    return new Date();
  }, [course]);

  const weekStartDate = useMemo(() => {
    const start = startOfWeek(baseScheduleDate);
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [baseScheduleDate, weekOffset]);

  const weekDays = useMemo(() => {
    const start = weekStartDate;
    return Array.from({ length: 7 }).map((_, index) => {
      const date = addDays(start, index);
      return {
        date,
        label: DAY_LABELS[date.getDay()],
        abbr: DAY_ABBR[date.getDay()],
        display: formatShortDate(date),
      };
    });
  }, [weekStartDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0].date;
    const last = weekDays[weekDays.length - 1].date;
    return `${formatShortDate(first)} - ${formatShortDate(last)}`;
  }, [weekDays]);

  const weeklySlots = useMemo(() => {
    const start = weekDays[0]?.date;
    const end = weekDays[6]?.date;
    if (!start || !end) return [];

    const startTime = new Date(start);
    startTime.setHours(0, 0, 0, 0);
    const endTime = new Date(end);
    endTime.setHours(23, 59, 59, 999);

    return schedule.filter((slot) => {
      const slotStart = new Date(slot.startTime);
      return slotStart >= startTime && slotStart <= endTime;
    });
  }, [schedule, weekDays]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, ScheduleSlot[]>();
    weekDays.forEach((day) => {
      map.set(day.date.toDateString(), []);
    });
    weeklySlots.forEach((slot) => {
      const slotDate = new Date(slot.startTime);
      const key = slotDate.toDateString();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(slot);
    });
    weekDays.forEach((day) => {
      const list = map.get(day.date.toDateString());
      if (list) {
        list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      }
    });
    return map;
  }, [weekDays, weeklySlots]);

  const resetSlotForm = (presetDate = "", presetStart = lastSlotTimes.start, presetEnd = lastSlotTimes.end) => {
    setSlotForm({
      date: presetDate,
      startTime: presetStart,
      endTime: presetEnd,
      subject: "",
      classroomName: "",
      instructorId: "",
      notes: "",
    });
    setSlotFormError("");
    setSlotFormSuccess("");
    setEditingSlotId(null);
  };

  const openCreateSlotModalForDateTime = (date: Date, hour: number) => {
    const presetDate = toInputDate(date);
    const startHour = hour.toString().padStart(2, "0");
    const endHour = (hour + 1).toString().padStart(2, "0");
    resetSlotForm(presetDate, `${startHour}:00`, `${endHour}:00`);
    setSlotModalMode("create");
    setSlotModalOpen(true);
  };

  const openEditSlotModal = (slot: ScheduleSlot) => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    setSlotModalMode("edit");
    setEditingSlotId(slot.id);
    setSlotForm({
      date: toInputDate(start),
      startTime: `${start.getHours().toString().padStart(2, "0")}:${start
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      endTime: `${end.getHours().toString().padStart(2, "0")}:${end
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      subject: slot.subject || "",
      classroomName: slot.classroomName || "",
      instructorId: slot.instructor?.id ? String(slot.instructor.id) : "",
      notes: slot.notes || "",
    });
    setSlotFormError("");
    setSlotFormSuccess("");
    setSlotModalOpen(true);
  };

  const handleSlotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSlotFormError("");
    setSlotFormSuccess("");
    setSlotFormSubmitting(true);

    try {
      if (!slotForm.date || !slotForm.startTime || !slotForm.endTime) {
        setSlotFormError("Tarih ve saat alanları zorunludur.");
        setSlotFormSubmitting(false);
        return;
      }

      const start = parseLocalDateTime(slotForm.date, slotForm.startTime);
      const end = parseLocalDateTime(slotForm.date, slotForm.endTime);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setSlotFormError("Geçerli bir tarih ve saat seçin.");
        setSlotFormSubmitting(false);
        return;
      }

      if (end <= start) {
        setSlotFormError("Bitiş saati başlangıç saatinden sonra olmalıdır.");
        setSlotFormSubmitting(false);
        return;
      }

      const payload = {
        courseId,
        instructorId: slotForm.instructorId ? Number(slotForm.instructorId) : undefined,
        classroomName: slotForm.classroomName || undefined,
        subject: slotForm.subject || undefined,
        notes: slotForm.notes || undefined,
        startTime: buildLocalDateTime(slotForm.date, slotForm.startTime),
        endTime: buildLocalDateTime(slotForm.date, slotForm.endTime),
      };

      if (slotModalMode === "create") {
        await api.post("/schedule", payload);
        setSlotFormSuccess("Ders oturumu başarıyla oluşturuldu.");
      } else if (editingSlotId) {
        await api.put(`/schedule/${editingSlotId}`, {
          instructorId: payload.instructorId,
          classroomName: payload.classroomName,
          subject: payload.subject,
          notes: payload.notes,
          startTime: payload.startTime,
          endTime: payload.endTime,
        });
        setSlotFormSuccess("Ders oturumu güncellendi.");
      }

      setLastSlotTimes({
        start: slotForm.startTime || lastSlotTimes.start,
        end: slotForm.endTime || lastSlotTimes.end,
      });

      await loadSchedule();
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Ders oturumu kaydedilirken hata oluştu.";
      setSlotFormError(message);
      return;
    } finally {
      setSlotFormSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm("Bu ders oturumunu silmek istediğinizden emin misiniz?")) {
      return;
    }
    try {
      await api.delete(`/schedule/${slotId}`);
      await loadSchedule();
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Ders oturumu silinirken hata oluştu.";
      alert(message);
    }
  };

  const toggleBulkDay = (value: number) => {
    setBulkForm((prev) => {
      const exists = prev.daysOfWeek.includes(value);
      return {
        ...prev,
        daysOfWeek: exists
          ? prev.daysOfWeek.filter((day) => day !== value)
          : [...prev.daysOfWeek, value],
      };
    });
  };

  const handleBulkGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBulkFormError("");
    setBulkFormSuccess("");
    setBulkFormSubmitting(true);

    try {
      if (!bulkForm.startDate || !bulkForm.endDate) {
        setBulkFormError("Başlangıç ve bitiş tarihlerini seçin.");
        setBulkFormSubmitting(false);
        return;
      }
      if (!bulkForm.startTime || !bulkForm.endTime) {
        setBulkFormError("Başlangıç ve bitiş saatlerini seçin.");
        setBulkFormSubmitting(false);
        return;
      }
      if (bulkForm.daysOfWeek.length === 0) {
        setBulkFormError("En az bir gün seçmelisiniz.");
        setBulkFormSubmitting(false);
        return;
      }

      const startDate = new Date(`${bulkForm.startDate}T00:00:00`);
      const endDate = new Date(`${bulkForm.endDate}T23:59:59`);

      if (endDate < startDate) {
        setBulkFormError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        setBulkFormSubmitting(false);
        return;
      }

      const results = { success: 0, failure: 0 };
      const errorMessages = new Set<string>();

      for (
        let cursor = new Date(startDate);
        cursor <= endDate;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const day = cursor.getDay();
        if (!bulkForm.daysOfWeek.includes(day)) {
          continue;
        }

        const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        const start = parseLocalDateTime(dateStr, bulkForm.startTime);
        const end = parseLocalDateTime(dateStr, bulkForm.endTime);

        if (end <= start) {
          results.failure += 1;
          continue;
        }

        try {
          await api.post("/schedule", {
            courseId,
            instructorId: bulkForm.instructorId ? Number(bulkForm.instructorId) : undefined,
            classroomName: bulkForm.classroomName || undefined,
            subject: bulkForm.subject || undefined,
            startTime: buildLocalDateTime(dateStr, bulkForm.startTime),
            endTime: buildLocalDateTime(dateStr, bulkForm.endTime),
          });
          results.success += 1;
        } catch (err: any) {
          results.failure += 1;
          const message = err?.response?.data?.message;
          if (message) {
            errorMessages.add(message);
          }
        }
      }

      const successMessage =
        results.success > 0
          ? `${results.success} ders oturumu oluşturuldu.${
              results.failure ? ` ${results.failure} oturum oluşturulamadı.` : ""
            }`
          : "";
      const aggregatedError = Array.from(errorMessages).join(" ");

      setBulkFormSuccess(successMessage);
      setBulkFormError(aggregatedError);

      await loadSchedule();
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Toplu ders programı oluşturulurken hata oluştu.";
      setBulkFormError(message);
      return;
    } finally {
      setBulkFormSubmitting(false);
    }
  };

  if (!authorized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Ders planlayıcı yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Planlayıcı yüklenemedi</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/courses/${courseId}`)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Kurs detayına geri dön
          </button>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  const gridHeight = HOURS.length * CELL_HEIGHT;
  const startHour = HOURS[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50">
      <nav className="bg-white shadow-lg border-b-2 border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/courses/${courseId}`)}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← Kurs Detayına Dön
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📅</span>
                Ders Programı Planlayıcısı
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              {course.srcTypeName} • {course.group.year}-{String(course.group.month).padStart(2, "0")}
              -GRUP {course.group.groupNo}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-6">
        <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Kurs</h3>
              <p className="text-lg font-bold text-gray-900">SRC{course.srcType}</p>
              <p className="text-sm text-gray-500">
                {course.group.year}-{String(course.group.month).padStart(2, "0")}-GRUP {course.group.groupNo}
                {course.group.branch ? ` • ${course.group.branch}` : ""}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Dönem</h3>
              <p className="text-lg font-bold text-gray-900">
                {new Date(course.group.startDate).toLocaleDateString("tr-TR")} -{" "}
                {new Date(course.group.endDate).toLocaleDateString("tr-TR")}
              </p>
              <p className="text-sm text-gray-500">Planlanan Saat: {course.plannedHours}</p>
            </div>
            <div className="flex md:justify-end items-center">
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab("create")}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    activeTab === "create"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  }`}
                >
                  Ders Ekle
                </button>
                <button
                  onClick={() => {
                    setBulkModalOpen(true);
                    setBulkFormError("");
                    setBulkFormSuccess("");
                  }}
                  className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 text-sm font-medium transition"
                >
                  Toplu Planlama
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Haftalık Görünüm</h2>
              <p className="text-sm text-gray-500">
                Dikey sütunlarda günler, yatay satırlarda saatler listelenir. Boş bir alana tıklayarak yeni ders
                oturumu ekleyebilir, mevcut oturumlara tıklayarak düzenleyebilir veya silebilirsiniz.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="px-3 py-2 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-sm font-medium"
              >
                ‹ Önceki Hafta
              </button>
              <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold">
                {weekRangeLabel}
              </div>
              <button
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="px-3 py-2 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-sm font-medium"
              >
                Sonraki Hafta ›
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div
              className="grid border border-gray-200 rounded-xl overflow-hidden"
              style={{ gridTemplateColumns: `80px repeat(${weekDays.length}, minmax(0, 1fr))` }}
            >
              <div className="bg-gray-50 border-b border-gray-200 flex flex-col">
                <div className="h-12 flex items-center justify-center text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
                  Saat
                </div>
                {HOURS.map((hour) => (
                  <div
                    key={`time-${hour}`}
                    className="flex items-center justify-center text-xs text-gray-500"
                    style={{ height: CELL_HEIGHT }}
                  >
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>
              {weekDays.map((day) => {
                const dayKey = day.date.toDateString();
                const daySlots = groupedSlots.get(dayKey) || [];
                return (
                  <div key={dayKey} className="border-l border-gray-200">
                    <div className="h-12 bg-gray-50 border-b border-gray-200 flex flex-col items-center justify-center">
                      <span className="text-xs uppercase text-gray-500">{day.abbr}</span>
                      <span className="text-sm font-semibold text-gray-800">{day.display}</span>
                    </div>
                    <div className="relative" style={{ height: gridHeight }}>
                      {HOURS.map((hour, index) => (
                        <div
                          key={`gridline-${dayKey}-${hour}`}
                          className="absolute inset-x-0 border-t border-gray-100"
                          style={{ top: index * CELL_HEIGHT }}
                        />
                      ))}

                      {HOURS.map((hour, index) => (
                        <button
                          key={`slot-button-${dayKey}-${hour}`}
                          type="button"
                          onClick={() => openCreateSlotModalForDateTime(day.date, hour)}
                          className="absolute inset-x-1 bg-transparent hover:bg-indigo-50/50 transition"
                          style={{
                            top: index * CELL_HEIGHT,
                            height: CELL_HEIGHT,
                          }}
                          title={`${day.label} ${hour.toString().padStart(2, "0")}:00`}
                        />
                      ))}

                      {daySlots.map((slot) => {
                        const start = new Date(slot.startTime);
                        const end = new Date(slot.endTime);
                        const totalMinutes = Math.max(
                          30,
                          Math.round((end.getTime() - start.getTime()) / (1000 * 60))
                        );
                        const top =
                          ((start.getHours() + start.getMinutes() / 60) - startHour) * CELL_HEIGHT;
                        const height = (totalMinutes / 60) * CELL_HEIGHT;

                        return (
                          <div
                            key={slot.id}
                            className="absolute inset-x-1 rounded-lg shadow-md border border-indigo-200 bg-indigo-100 text-indigo-800 text-xs p-2 cursor-pointer hover:bg-indigo-200"
                            style={{ top, height }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditSlotModal(slot);
                            }}
                          >
                            <div className="font-semibold text-sm">
                              {slot.subject || "Ders"} ({start
                                .getHours()
                                .toString()
                                .padStart(2, "0")}
                              :
                              {start.getMinutes().toString().padStart(2, "0")} -{" "}
                              {end.getHours().toString().padStart(2, "0")}:
                              {end.getMinutes().toString().padStart(2, "0")})
                            </div>
                            {slot.instructor && (
                              <div className="text-xs text-indigo-700 mt-1">{slot.instructor.fullName}</div>
                            )}
                            {slot.classroomName && (
                              <div className="text-[11px] text-indigo-600 mt-1">{slot.classroomName}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bu Hafta Planlanan Oturumlar</h3>
          {weeklySlots.length === 0 ? (
            <div className="text-sm text-gray-500">Bu hafta için planlanmış ders bulunmuyor.</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">
                      Saat
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">
                      Ders
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">
                      Eğitmen
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">
                      Derslik
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weeklySlots.map((slot) => {
                    const start = new Date(slot.startTime);
                    const end = new Date(slot.endTime);
                    return (
                      <tr key={`table-${slot.id}`}>
                        <td className="px-4 py-3 text-gray-700">
                          {start.toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{slot.subject || "Ders"}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {slot.instructor?.fullName || (
                            <span className="text-xs text-gray-400">Atanmamış</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{slot.classroomName || "-"}</td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => openEditSlotModal(slot)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {slotModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {slotModalMode === "create" ? "Yeni Ders Oturumu" : "Ders Oturumunu Düzenle"}
                </h3>
                <p className="text-xs text-gray-500">
                  Tarih, saat, eğitmen ve derslik bilgilerini belirleyin.
                </p>
              </div>
              <button
                onClick={() => {
                  setSlotModalOpen(false);
                  resetSlotForm();
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSlotSubmit} className="p-6 space-y-4">
              {slotFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {slotFormError}
                </div>
              )}
              {slotFormSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {slotFormSuccess}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarih</label>
                  <input
                    type="date"
                    value={slotForm.date}
                    onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç</label>
                    <input
                      type="time"
                      value={slotForm.startTime}
                      onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş</label>
                    <input
                      type="time"
                      value={slotForm.endTime}
                      onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Eğitmen (opsiyonel)
                  </label>
                  <select
                    value={slotForm.instructorId}
                    onChange={(e) => setSlotForm({ ...slotForm, instructorId: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={instructorsLoading}
                  >
                    <option value="">Seçiniz</option>
                    {instructors.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.fullName}
                      </option>
                    ))}
                  </select>
                  {instructorsLoading && (
                    <p className="text-xs text-gray-500 mt-1">Eğitmen listesi yükleniyor...</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Derslik (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={slotForm.classroomName}
                    onChange={(e) => setSlotForm({ ...slotForm, classroomName: e.target.value })}
                    placeholder="Derslik adı ya da numarası"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ders / Konu (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={slotForm.subject}
                    onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })}
                    placeholder="Örn: Trafik Güvenliği"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notlar (opsiyonel)
                  </label>
                  <textarea
                    value={slotForm.notes}
                    onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })}
                    placeholder="Eğitmen veya katılımcılar için notlar..."
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setSlotModalOpen(false);
                    resetSlotForm();
                  }}
                  className="px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={slotFormSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                >
                  {slotFormSubmitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Haftalık Ders Planlama</h3>
                <p className="text-xs text-gray-500">
                  Belirlediğiniz gün ve saatlerde seçili tarih aralığı için otomatik oturumlar oluşturulur.
                </p>
              </div>
              <button
                onClick={() => {
                  setBulkModalOpen(false);
                  setBulkFormError("");
                  setBulkFormSuccess("");
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleBulkGenerate} className="p-6 space-y-4">
              {bulkFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {bulkFormError}
                </div>
              )}
              {bulkFormSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {bulkFormSuccess}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={bulkForm.startDate}
                    onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    value={bulkForm.endDate}
                    onChange={(e) => setBulkForm({ ...bulkForm, endDate: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Saati
                  </label>
                  <input
                    type="time"
                    value={bulkForm.startTime}
                    onChange={(e) => setBulkForm({ ...bulkForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bitiş Saati
                  </label>
                  <input
                    type="time"
                    value={bulkForm.endTime}
                    onChange={(e) => setBulkForm({ ...bulkForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gün Seçimi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleBulkDay(day.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                        bulkForm.daysOfWeek.includes(day.value)
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {bulkForm.daysOfWeek.length === 0 && (
                  <p className="text-xs text-red-600 mt-2">En az bir gün seçmelisiniz.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Eğitmen (opsiyonel)
                  </label>
                  <select
                    value={bulkForm.instructorId}
                    onChange={(e) => setBulkForm({ ...bulkForm, instructorId: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={instructorsLoading}
                  >
                    <option value="">Seçiniz</option>
                    {instructors.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Derslik (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={bulkForm.classroomName}
                    onChange={(e) => setBulkForm({ ...bulkForm, classroomName: e.target.value })}
                    placeholder="Örn: A Blok 101"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ders / Konu (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={bulkForm.subject}
                    onChange={(e) => setBulkForm({ ...bulkForm, subject: e.target.value })}
                    placeholder="Örn: Trafik Güvenliği"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setBulkModalOpen(false);
                    setBulkFormError("");
                    setBulkFormSuccess("");
                  }}
                  className="px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={bulkFormSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                >
                  {bulkFormSubmitting ? "Oluşturuluyor..." : "Oturumları Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

