"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";

type TabKey = "overview" | "schedule" | "students" | "exams" | "mebbis";

interface CourseDetailResponse {
  id: number;
  srcType: number;
  srcTypeName: string;
  isMixed: boolean;
  mixedTypes?: string | null;
  plannedHours: number;
  mebApprovalStatus: string;
  approvalAt?: string | null;
  approvalNotes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
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
    status: string;
    name: string;
    courses: {
      id: number;
      srcType: number;
      srcTypeName: string;
      plannedHours: number;
      isMixed: boolean;
      mixedTypes?: string | null;
      mebApprovalStatus: string;
      enrollmentCount: number;
      createdAt: string;
    }[];
  };
  summary: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    upcomingScheduleCount: number;
    upcomingExamCount: number;
    lastTransferStatus?: string | null;
  };
  schedule: ScheduleSlot[];
  students: CourseStudent[];
  exams: CourseExam[];
  mebbisTransfers: MebbisTransferSummary[];
}

interface ScheduleSlot {
  id: number;
  subject?: string | null;
  classroomName?: string | null;
  startTime: string;
  endTime: string;
  instructor?: {
    id: number;
    fullName: string;
    username: string;
  } | null;
  attendanceCount: number;
  presentCount: number;
}

interface CourseStudent {
  id: number;
  student: {
    id: number;
    tcKimlikNo: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
  };
  status: string;
  enrollmentDate: string;
  attendanceRate?: number | null;
  examAttempts: number;
}

interface StudentSearchResult {
  id: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}

interface CourseExam {
  id: number;
  examType: string;
  examDate: string;
  mebSessionCode?: string | null;
  status: string;
  notes?: string | null;
  participantCount: number;
  passedCount: number;
  failedCount: number;
}

interface MebbisTransferSummary {
  id: number;
  mode: string;
  status: string;
  successCount: number;
  failureCount: number;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
}

interface InstructorSummary {
  id: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
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

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 0, label: "Pazar" },
];

const DAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const DAY_ABBR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];
const MAX_WEEKLY_MINUTES = 40 * 60;

const ensureTimeWithSeconds = (time: string) => (time.length === 5 ? `${time}:00` : time);
const buildLocalDateTime = (date: string, time: string) => `${date}T${ensureTimeWithSeconds(time)}`;
const parseLocalDateTime = (date: string, time: string) => new Date(buildLocalDateTime(date, time));

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = Number(params.id);

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [pendingTransfer, setPendingTransfer] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [instructors, setInstructors] = useState<InstructorSummary[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [instructorsError, setInstructorsError] = useState("");
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotModalMode, setSlotModalMode] = useState<"create" | "edit">("create");
  const [slotFormSubmitting, setSlotFormSubmitting] = useState(false);
  const [slotFormError, setSlotFormError] = useState("");
  const [slotFormSuccess, setSlotFormSuccess] = useState("");
  const [slotForm, setSlotForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    subject: "",
    classroomName: "",
    instructorId: "",
  });
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
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
  const [lastSlotTimes, setLastSlotTimes] = useState({ start: "09:00", end: "12:00" });
  const [weekOffset, setWeekOffset] = useState(0);
  const [instructorManagerOpen, setInstructorManagerOpen] = useState(false);
  const [createInstructorSubmitting, setCreateInstructorSubmitting] = useState(false);
  const [createInstructorError, setCreateInstructorError] = useState("");
  const [createInstructorSuccess, setCreateInstructorSuccess] = useState("");
  const [instructorForm, setInstructorForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    role: "Egitmen",
  });
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupFormSubmitting, setGroupFormSubmitting] = useState(false);
  const [groupFormError, setGroupFormError] = useState("");
  const [groupForm, setGroupForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    groupNo: 1,
    branch: "",
    startDate: "",
    endDate: "",
    capacity: 30,
    status: "draft",
  });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [availableStudents, setAvailableStudents] = useState<StudentSearchResult[]>([]);
  const [availableStudentsLoading, setAvailableStudentsLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<StudentSearchResult[]>([]);
  const [assignStatus, setAssignStatus] = useState("active");
  const [assignError, setAssignError] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const filteredAvailableStudents = useMemo(() => {
    const term = studentQuery.trim().toLowerCase();
    const existingIds =
      course?.students.reduce<Set<number>>((set, enrollment) => {
        set.add(enrollment.student.id);
        return set;
      }, new Set<number>()) ?? new Set<number>();

    return availableStudents
      .filter((student) => !existingIds.has(student.id))
      .filter((student) => {
        if (!term) return true;
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        const phone = student.phone?.toLowerCase() ?? "";
        const email = student.email?.toLowerCase() ?? "";
        return (
          fullName.includes(term) ||
          student.tcKimlikNo.toLowerCase().includes(term) ||
          phone.includes(term) ||
          email.includes(term)
        );
      });
  }, [studentQuery, availableStudents, course]);

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
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!course) return;
    setGroupForm({
      year: course.group.year,
      month: course.group.month,
      groupNo: course.group.groupNo,
      branch: course.group.branch || "",
      startDate: toInputDate(course.group.startDate),
      endDate: toInputDate(course.group.endDate),
      capacity: course.group.capacity,
      status: course.group.status,
    });
  }, [course]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<CourseDetailResponse>(`/courses/${courseId}`);
        setCourse(response.data);

      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.replace("#", "") as TabKey;
        if (["overview", "schedule", "students", "exams", "mebbis"].includes(hash)) {
          setActiveTab(hash);
        }
      }
    } catch (err: any) {
      console.error("Course detail load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Kurs detayları yüklenirken bir hata oluştu.";
      setError(message);
    } finally {
        setLoading(false);
    }
  };

  const loadInstructors = async () => {
    try {
      setInstructorsLoading(true);
      setInstructorsError("");
      const response = await api.get<InstructorSummary[]>("/instructors");
      setInstructors(response.data || []);
    } catch (err: any) {
      console.error("Instructor list load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Eğitmen listesi yüklenirken bir hata oluştu.";
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
    const diff = (day + 6) % 7; // Monday as first day
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

const toInputDate = (value: string | Date) => {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

const toInputTime = (value: string | Date) => {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const resetSlotForm = (presetDate = "") => {
    setSlotForm({
      date: presetDate,
      startTime: lastSlotTimes.start,
      endTime: lastSlotTimes.end,
      subject: "",
      classroomName: "",
      instructorId: "",
    });
    setSlotFormError("");
    setSlotFormSuccess("");
    setEditingSlotId(null);
  };

  const openCreateSlotModal = () => {
    const defaultDate =
      course && course.group?.startDate ? toInputDate(course.group.startDate) : "";
    resetSlotForm(defaultDate);
    setSlotModalMode("create");
    setSlotModalOpen(true);
  };

const openCreateSlotModalForDate = (date: Date) => {
  resetSlotForm(toInputDate(date));
    setSlotModalMode("create");
    setSlotModalOpen(true);
  };

  const openGroupEditModal = () => {
    if (!course) return;
    setGroupForm({
      year: course.group.year,
      month: course.group.month,
      groupNo: course.group.groupNo,
      branch: course.group.branch || "",
      startDate: toInputDate(course.group.startDate),
      endDate: toInputDate(course.group.endDate),
      capacity: course.group.capacity,
      status: course.group.status,
    });
    setGroupFormError("");
    setGroupModalOpen(true);
  };

  const handleGroupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course) return;
    setGroupFormError("");

    if (!groupForm.startDate || !groupForm.endDate) {
      setGroupFormError("Başlangıç ve bitiş tarihleri gereklidir.");
      return;
    }

    try {
      setGroupFormSubmitting(true);
      await api.put(`/courses/groups/${course.group.id}`, {
        year: groupForm.year,
        month: groupForm.month,
        groupNo: groupForm.groupNo,
        branch: groupForm.branch.trim() || undefined,
        startDate: groupForm.startDate,
        endDate: groupForm.endDate,
        capacity: groupForm.capacity,
        status: groupForm.status,
      });
      setGroupModalOpen(false);
      await loadCourse();
    } catch (err: any) {
      console.error("Group update error:", err);
      const message =
        err.response?.data?.message || err.message || "Sınıf bilgileri güncellenirken hata oluştu.";
      setGroupFormError(message);
    } finally {
      setGroupFormSubmitting(false);
    }
  };

  const loadAvailableStudents = async () => {
    setAvailableStudentsLoading(true);
    try {
      const response = await api.get<StudentSearchResult[]>("/students?hasActiveCourse=false");
      const data = response.data || [];
      setAvailableStudents(data);
    } catch (err: any) {
      console.error("Available students load error:", err);
      const message =
        err.response?.data?.message || err.message || "Uygun kursiyerler yüklenirken bir hata oluştu.";
      setAssignError(message);
      setAvailableStudents([]);
    } finally {
      setAvailableStudentsLoading(false);
    }
  };

  const toggleStudentSelection = (student: StudentSearchResult) => {
    setSelectedStudents((prev) => {
      const exists = prev.some((item) => item.id === student.id);
      if (exists) {
        return prev.filter((item) => item.id !== student.id);
      }
      return [...prev, student];
    });
  };

  const openAssignModal = () => {
    setAssignError("");
    setStudentQuery("");
    setSelectedStudents([]);
    setAssignStatus("active");
    setAssignModalOpen(true);
    loadAvailableStudents();
  };

  const handleAssignStudents = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course) return;
    if (selectedStudents.length === 0) {
      setAssignError("Lütfen en az bir kursiyer seçin.");
      return;
    }

    setAssignSubmitting(true);
    setAssignError("");

    try {
      let successCount = 0;
      let failureCount = 0;
      const failed: StudentSearchResult[] = [];

      for (const student of selectedStudents) {
        try {
          await api.post(`/courses/groups/${course.group.id}/students`, {
            studentId: student.id,
            courseId: course.id,
            status: assignStatus,
          });
          successCount += 1;
        } catch (err) {
          console.error("Assign student error:", err);
          failureCount += 1;
          failed.push(student);
        }
      }

      if (failureCount > 0) {
        setAssignError(
          `${successCount} kursiyer başarıyla eklendi, ${failureCount} kursiyer eklenemedi. Tekrar denemek için listede kalanları kontrol edin.`
        );
        setSelectedStudents(failed);
        await loadAvailableStudents();
      } else {
        setAssignModalOpen(false);
        setSelectedStudents([]);
        setStudentQuery("");
      }

      await loadCourse();
    } catch (err: any) {
      console.error("Assign student general error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Kursiyerler eklenirken beklenmedik bir hata oluştu.";
      setAssignError(message);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!course) return;
    if (!confirm("Bu kursiyeri dersten kaldırmak istediğinizden emin misiniz?")) {
      return;
    }

    try {
      await api.delete(`/courses/${course.id}/students/${studentId}`);
      await loadCourse();
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Kursiyer kaldırılırken hata oluştu.";
      alert(message);
    }
  };

  const openEditSlotModal = (slot: ScheduleSlot) => {
    setSlotModalMode("edit");
    setEditingSlotId(slot.id);
    setSlotForm({
    date: toInputDate(slot.startTime),
    startTime: toInputTime(slot.startTime),
    endTime: toInputTime(slot.endTime),
      subject: slot.subject || "",
      classroomName: slot.classroomName || "",
      instructorId: slot.instructor ? String(slot.instructor.id) : "",
    });
    setSlotFormError("");
    setSlotFormSuccess("");
    setSlotModalOpen(true);
  };

  const handleSlotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course) return;
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
          startTime: payload.startTime,
          endTime: payload.endTime,
        });
        setSlotFormSuccess("Ders oturumu güncellendi.");
      }

      setLastSlotTimes({
        start: slotForm.startTime || lastSlotTimes.start,
        end: slotForm.endTime || lastSlotTimes.end,
      });

      await loadCourse();
    } catch (err: any) {
      console.error("Schedule slot save error:", err);
      const message =
        err.response?.data?.message || err.message || "Ders oturumu kaydedilirken hata oluştu.";
      setSlotFormError(message);
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
      await loadCourse();
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
    if (!course) return;

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

      const startDate = parseLocalDateTime(bulkForm.startDate, "00:00");
      const endDate = parseLocalDateTime(bulkForm.endDate, "23:59");

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
      await loadCourse();
    } catch (err: any) {
      console.error("Bulk schedule create error:", err);
      const message =
        err.response?.data?.message || err.message || "Toplu ders programı oluşturulurken hata oluştu.";
      setBulkFormError(message);
    } finally {
      setBulkFormSubmitting(false);
    }
  };

  const handleCreateInstructor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateInstructorError("");
    setCreateInstructorSuccess("");
    setCreateInstructorSubmitting(true);

    try {
      if (!instructorForm.fullName.trim() || !instructorForm.username.trim() || !instructorForm.password.trim()) {
        setCreateInstructorError("Ad soyad, kullanıcı adı ve şifre zorunludur.");
        setCreateInstructorSubmitting(false);
        return;
      }

      await api.post("/instructors", {
        fullName: instructorForm.fullName.trim(),
        username: instructorForm.username.trim(),
        email: instructorForm.email.trim(),
        password: instructorForm.password,
        role: instructorForm.role,
      });

      setCreateInstructorSuccess("Eğitmen başarıyla eklendi.");
      setInstructorForm({
        fullName: "",
        username: "",
        email: "",
        password: "",
        role: "Egitmen",
      });
      await loadInstructors();
    } catch (err: any) {
      console.error("Instructor create error:", err);
      const message =
        err.response?.data?.message || err.message || "Eğitmen eklenirken hata oluştu.";
      setCreateInstructorError(message);
      return;
    } finally {
      setCreateInstructorSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const groupStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-200 text-gray-600";
      case "draft":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-amber-100 text-amber-700";
    }
  };

  const statusText = (status: string) => {
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

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "-";
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

  const formatDate = (iso?: string | null) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString("tr-TR");
    } catch {
      return iso;
    }
  };

  const maskTc = (tc: string) => {
    if (tc.length !== 11) return tc;
    return `${tc.slice(0, 3)}***${tc.slice(6)}`;
  };

  const examTypeText = (type: string) => (type === "practical" ? "Uygulama" : "Yazılı");

  const runMebbisTransfer = async (mode: "dry_run" | "live") => {
    if (!confirm(`${mode === "dry_run" ? "Dry run" : "Canlı"} aktarımı başlatmak istiyor musunuz?`)) {
      return;
    }

    try {
      setPendingTransfer(true);
      setTransferError("");
      await api.post(`/mebbis-transfer/${courseId}?mode=${mode}`);
      await loadCourse();
      alert("MEBBİS aktarımı başlatıldı.");
    } catch (err: any) {
      console.error("MEBBIS transfer error:", err);
      const message =
        err.response?.data?.message || err.message || "MEBBİS aktarımı başlatılırken hata oluştu.";
      setTransferError(message);
    } finally {
      setPendingTransfer(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as TabKey;
    if (hash && ["overview", "schedule", "students", "exams", "mebbis"].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  const handleTabChange = (tab: TabKey) => {
    if (tab === "schedule") {
      router.push(`/courses/${courseId}/scheduler`);
      return;
    }
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = tab;
      window.history.replaceState(null, "", url.toString());
    }
  };

  useEffect(() => {
    if (activeTab === "schedule") {
      router.push(`/courses/${courseId}/scheduler`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const attendanceRateText = (rate?: number | null) => {
    if (rate == null) return "N/A";
    return `${Math.round(rate * 100)}%`;
  };

  const averageAttendance =
    course?.students && course.students.length
      ? course.students.reduce((sum, s) => sum + (s.attendanceRate ?? 0), 0) /
        course.students.length
      : 0;

  const totalExamParticipants = useMemo(() => {
    if (!course?.exams) return 0;
    return course.exams.reduce((sum, exam) => sum + exam.participantCount, 0);
  }, [course?.exams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Kurs detayları yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Kurs bilgileri alınamadı</h1>
          <p className="text-gray-600 mb-6">{error || "Kurs bulunamadı."}</p>
          <button
            onClick={() => router.push("/courses")}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Kurs listesine dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <nav className="bg-white shadow-lg border-b-2 border-green-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/courses")}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                ← Kurslara Dön
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {course.srcTypeName} • {course.group.year}-{course.group.month}-GRUP{" "}
                {course.group.groupNo}
                {course.group.branch ? ` (${course.group.branch})` : ""}
              </h1>
            </div>
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full self-center ${statusBadge(
                course.mebApprovalStatus
              )}`}
            >
              {statusText(course.mebApprovalStatus)}
              </span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Toplam Kursiyer"
              value={course.summary.totalEnrollments}
              subtitle={`Aktif: ${course.summary.activeEnrollments} • Tamamlanan: ${course.summary.completedEnrollments}`}
              gradient="from-green-500 to-green-600"
              icon="👥"
            />
            <SummaryCard
              title="Ders Saatleri"
              value={`${course.plannedHours} saat`}
              subtitle={`Bugün/İleri: ${course.summary.upcomingScheduleCount}`}
              gradient="from-emerald-500 to-emerald-600"
              icon="📅"
            />
            <SummaryCard
              title="Yaklaşan Sınav"
              value={`${course.summary.upcomingExamCount}`}
              subtitle={`Toplam katılımcı: ${totalExamParticipants}`}
              gradient="from-teal-500 to-teal-600"
              icon="📝"
            />
            <SummaryCard
              title="Son MEB Aktarımı"
              value={course.summary.lastTransferStatus ? course.summary.lastTransferStatus : "Yok"}
              subtitle="Son aktarımın durumu"
              gradient="from-blue-500 to-cyan-600"
              icon="📤"
            />
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Genel Bilgiler</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DetailItem label="Kurs Tipi">SRC{course.srcType}</DetailItem>
              <DetailItem label="Karma Sınıf">
                {course.isMixed ? `Evet (${course.mixedTypes || "-"})` : "Hayır"}
              </DetailItem>
              <DetailItem label="Planlanan Saat">{course.plannedHours}</DetailItem>
              <DetailItem label="Sınıf Dönemi">
                {formatDate(course.group.startDate)} - {formatDate(course.group.endDate)}
              </DetailItem>
              <DetailItem label="Kontenjan">{course.group.capacity}</DetailItem>
              <DetailItem label="Kayıt Tarihi">{formatDate(course.createdAt)}</DetailItem>
              <DetailItem label="Onay Tarihi">
                {course.approvalAt ? formatDate(course.approvalAt) : "-"}
              </DetailItem>
              <DetailItem label="Onay Notu">{course.approvalNotes || "-"}</DetailItem>
              <DetailItem label="Güncelleme Tarihi">
                {course.updatedAt ? formatDate(course.updatedAt) : "-"}
              </DetailItem>
            </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              <TabButton
                tab="overview"
                activeTab={activeTab}
                onClick={handleTabChange}
                label="Genel Bakış"
              />
              <TabButton
                tab="schedule"
                activeTab={activeTab}
                onClick={handleTabChange}
                label="Ders Programı"
              />
              <TabButton
                tab="students"
                activeTab={activeTab}
                onClick={handleTabChange}
                label="Kursiyerler"
              />
              <TabButton
                tab="exams"
                activeTab={activeTab}
                onClick={handleTabChange}
                label="Sınavlar"
              />
              <TabButton
                tab="mebbis"
                activeTab={activeTab}
                onClick={handleTabChange}
                label="MEBBİS Aktarımları"
              />
            </div>

            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Kursiyer Katılım Özeti
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Toplam kursiyer sayısı, ilerleme durumları ve ortalama yoklama oranı.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>
                      • Toplam: <strong>{course.summary.totalEnrollments}</strong>{" "}
                      kursiyer
                    </li>
                    <li>
                      • Aktif: <strong>{course.summary.activeEnrollments}</strong>
                    </li>
                    <li>
                      • Tamamlanan: <strong>{course.summary.completedEnrollments}</strong>
                    </li>
                    <li>
                      • Ortalama Yoklama:{" "}
                      <strong>{Math.round((averageAttendance || 0) * 100)}%</strong>
                    </li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Operasyon Özeti
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Yaklaşan dersler, sınavlar ve MEBBİS aktarım durumları hakkında bilgiler.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>
                      • Yaklaşan ders oturumları:{" "}
                      <strong>{course.summary.upcomingScheduleCount}</strong>
                    </li>
                    <li>
                      • Yaklaşan sınav sayısı:{" "}
                      <strong>{course.summary.upcomingExamCount}</strong>
                    </li>
                    <li>
                      • Son MEBBİS aktarım durumu:{" "}
                      <strong>{course.summary.lastTransferStatus || "Yok"}</strong>
                    </li>
                  </ul>
                </div>
                <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/60">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-800">Sınıf Kartı</h3>
                      <p className="text-xs text-emerald-700">
                        {course.group.name}
                      </p>
                    </div>
              <button
                      onClick={openGroupEditModal}
                      className="px-3 py-1 text-sm font-medium text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                      Düzenle
              </button>
            </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <dt className="font-semibold text-emerald-700">Dönem</dt>
                      <dd>
                        {formatDate(course.group.startDate)} - {formatDate(course.group.endDate)}
                      </dd>
          </div>
                    <div>
                      <dt className="font-semibold text-emerald-700">Şube</dt>
                      <dd>{course.group.branch || "Merkez"}</dd>
        </div>
                    <div>
                      <dt className="font-semibold text-emerald-700">Kontenjan</dt>
                      <dd>{course.group.capacity} kişi</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-emerald-700">Durum</dt>
                      <dd>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${groupStatusBadge(course.group.status)}`}>
                          {course.group.status}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {course.group.courses && course.group.courses.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-emerald-700 mb-2">Bağlı Kurslar</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        {course.group.courses.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium text-gray-800">
                                {item.srcTypeName} • {item.enrollmentCount} kursiyer
                              </div>
                              <div className="text-xs text-gray-500">
                                Oluşturma: {formatDate(item.createdAt)} • Durum: {item.mebApprovalStatus}
                              </div>
                            </div>
                            {item.id !== course.id && (
                              <button
                                onClick={() => router.push(`/courses/${item.id}`)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                              >
                                Aç
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                    <h3 className="text-lg font-semibold text-gray-900">Ders Programı</h3>
                    <p className="text-sm text-gray-500">
                      Haftalık ders saatlerini planlayın, eğitmenleri atayın ve gerektiğinde düzenleyin.
                </p>
              </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setInstructorManagerOpen(true)}
                      className="px-4 py-2 border-2 border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 text-sm font-medium"
                    >
                      Eğitmen Yönetimi
                    </button>
                    <button
                      onClick={openCreateSlotModal}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 text-sm font-medium shadow"
                    >
                      + Yeni Ders
                    </button>
                    <button
                      onClick={() => setBulkModalOpen(true)}
                      className="px-4 py-2 border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-sm font-medium"
                    >
                      Haftalık Planlama
                    </button>
                    <button
                      onClick={() => router.push(`/courses/${course.id}/scheduler`)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Planlayıcıyı Aç →
                    </button>
                  </div>
                </div>

                {instructorsError && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg">
                    {instructorsError}
                  </div>
                )}

                {!instructorsLoading && instructors.length === 0 && !instructorsError && (
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-lg">
                    Bu kurs için henüz kayıtlı eğitmen yok. "Eğitmen Yönetimi" butonuna tıklayarak eğitmen
                    ekleyebilir ve derslere atayabilirsiniz.
                  </div>
                )}

                <div className="bg-white border border-indigo-100 rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev - 1)}
                      className="px-3 py-1 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                    >
                      ‹ Önceki
                    </button>
                    <div className="text-sm font-semibold text-gray-700">{weekRangeLabel}</div>
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev + 1)}
                      className="px-3 py-1 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                    >
                      Sonraki ›
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const dateValue = toInputDate(day.date);
                      const isSelected = slotModalOpen && slotForm.date === dateValue;
                      return (
                        <button
                          key={day.date.toISOString()}
                          type="button"
                          onClick={() => openCreateSlotModalForDate(day.date)}
                          className={`flex flex-col items-center justify-center px-3 py-3 rounded-xl border transition ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-100 text-indigo-700"
                              : "border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700"
                          }`}
                        >
                          <span className="text-xs uppercase tracking-wide text-gray-500">{day.abbr}</span>
                          <span className="text-base font-semibold">{day.display}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500">
                    Gün seçtiğinizde "Yeni Ders" formu otomatik olarak o tarihle açılır. Saatleri aynı hafta
                    içinde hızlıca planlamak için ok butonlarıyla haftalar arasında gezinebilirsiniz.
                  </p>
                </div>

                {course.schedule.length === 0 ? (
                  <EmptyState message="Bu kurs için ders programı oluşturulmamış." />
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tarih / Saat
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Konu / Ders
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Eğitmen
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Derslik
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Yoklama
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            İşlemler
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {course.schedule.map((slot) => (
                          <tr key={slot.id}>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              <div>{formatDateTime(slot.startTime)}</div>
                              <div className="text-xs text-gray-500">
                                {formatDateTime(slot.endTime)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {slot.subject || "Ders"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {slot.instructor ? slot.instructor.fullName : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {slot.classroomName || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {slot.presentCount} / {slot.attendanceCount}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "students" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Kursiyerler</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={openAssignModal}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 text-sm font-medium shadow"
                    >
                      + Kursiyer Ekle
                    </button>
                    <button
                      onClick={() => router.push("/students")}
                      className="px-4 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm font-medium"
                    >
                      Kursiyer listesine git →
                    </button>
                  </div>
                </div>
                {course.students.length === 0 ? (
                  <EmptyState message="Bu kursa kayıtlı kursiyer bulunmuyor." />
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
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
                            Yoklama
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Sınav Hakları
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Kayıt Tarihi
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            İşlemler
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {course.students.map((student) => (
                          <tr key={student.id}>
                            <td className="px-6 py-4">
                              <div className="text-sm font-semibold text-indigo-700">
                                {student.student.firstName} {student.student.lastName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {maskTc(student.student.tcKimlikNo)}
                              </div>
                              {(student.student.phone || student.student.email) && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {student.student.phone && (
                                    <span className="mr-2">📞 {student.student.phone}</span>
                                  )}
                                  {student.student.email && (
                                    <span>✉️ {student.student.email}</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadge(
                                  student.status
                                )}`}
                              >
                                {student.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {attendanceRateText(student.attendanceRate)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {student.examAttempts} / 4
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDate(student.enrollmentDate)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleRemoveStudent(student.student.id)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                Sil
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "exams" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Sınavlar</h3>
                  <button
                    onClick={() => router.push("/exams")}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    Sınav listesine git →
                  </button>
                </div>
                {course.exams.length === 0 ? (
                  <EmptyState message="Bu kursa ait sınav bulunmuyor." />
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tarih
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tip
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Katılımcı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Başarı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Not
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {course.exams.map((exam) => (
                          <tr key={exam.id}>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDate(exam.examDate)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {examTypeText(exam.examType)}
                              {exam.mebSessionCode && (
                                <span className="text-xs text-gray-500 block mt-1">
                                  MEB Kodu: {exam.mebSessionCode}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {exam.participantCount}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              <span className="text-green-600 mr-2">
                                Geçti: {exam.passedCount}
                              </span>
                              <span className="text-red-600">
                                Kaldı: {exam.failedCount}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{exam.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "mebbis" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">MEBBİS Aktarım Geçmişi</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runMebbisTransfer("dry_run")}
                      disabled={pendingTransfer}
                      className="px-4 py-2 border border-green-200 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
                    >
                      Dry Run Başlat
                    </button>
                    <button
                      onClick={() => runMebbisTransfer("live")}
                      disabled={pendingTransfer}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Canlı Aktarım
                    </button>
                    <button
                      onClick={() => router.push("/mebbis-transfer")}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      Aktarım merkezine git →
                    </button>
                  </div>
                </div>
                {transferError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {transferError}
                  </div>
                )}
                {course.mebbisTransfers.length === 0 ? (
                  <EmptyState message="Bu kurs için MEBBİS aktarımı yapılmamış." />
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tarih
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Mod
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Durum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Sonuç
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Hata
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {course.mebbisTransfers.map((job) => (
                          <tr key={job.id}>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDateTime(job.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {job.mode === "live" ? "Canlı" : "Dry Run"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                  job.status === "completed"
                                    ? "bg-green-100 text-green-700"
                                    : job.status === "running"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {job.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {job.successCount} başarılı / {job.failureCount} hatalı
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {job.errorMessage || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {groupModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-emerald-800">Sınıf Kartını Güncelle</h3>
                <p className="text-xs text-emerald-700">
                  Sınıf bilgilerini resmi formata uygun şekilde düzenleyin; değişiklikler kurs listesine anında yansır.
                </p>
              </div>
              <button
                onClick={() => {
                  setGroupModalOpen(false);
                  setGroupFormError("");
                }}
                className="text-emerald-400 hover:text-emerald-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleGroupSubmit} className="p-6 space-y-4">
              {groupFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {groupFormError}
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
                    value={groupForm.year}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, year: parseInt(e.target.value) || prev.year }))
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
                    value={groupForm.month}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, month: parseInt(e.target.value) || prev.month }))
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Grup No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={groupForm.groupNo}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, groupNo: parseInt(e.target.value) || prev.groupNo }))
                    }
                    required
                    className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Şube</label>
                  <input
                    type="text"
                    value={groupForm.branch}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, branch: e.target.value }))
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
                    value={groupForm.startDate}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, startDate: e.target.value }))
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
                    value={groupForm.endDate}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, endDate: e.target.value }))
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
                    value={groupForm.capacity}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, capacity: parseInt(e.target.value) || prev.capacity }))
                    }
                    required
                    className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Durum</label>
                  <select
                    value={groupForm.status}
                    onChange={(e) =>
                      setGroupForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="draft">Taslak</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
              </div>
            </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => {
                    setGroupModalOpen(false);
                    setGroupFormError("");
                  }}
                  className="px-5 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={groupFormSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 font-medium shadow-lg disabled:opacity-50"
                >
                  {groupFormSubmitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full">
            <div className="px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-emerald-800">Kursiyer Ata</h3>
              <button
                onClick={() => {
                  setAssignModalOpen(false);
                  setAssignError("");
                }}
                className="text-emerald-400 hover:text-emerald-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAssignStudents} className="p-6 space-y-4">
              {assignError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {assignError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">Uygun Kursiyerler</label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      placeholder="Listede ara (ad, soyad, TC, telefon, e-posta)"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      className="flex-1 px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={loadAvailableStudents}
                      className="px-4 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 text-sm font-medium disabled:opacity-50"
                      disabled={availableStudentsLoading}
                    >
                      {availableStudentsLoading ? "Yükleniyor..." : "Listeyi Yenile"}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-dashed border-emerald-200 rounded-xl bg-emerald-50">
                    {availableStudentsLoading ? (
                      <div className="px-4 py-6 text-sm text-emerald-700">Kursiyer listesi yükleniyor...</div>
                    ) : filteredAvailableStudents.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-emerald-600">
                        Uygun kursiyer bulunamadı. Yeni kursiyer eklemek için kursiyer listesine gidebilirsiniz.
                      </div>
                    ) : (
                      <table className="min-w-full text-sm">
                        <tbody>
                          {filteredAvailableStudents.map((student) => {
                            const isSelected = selectedStudents.some((item) => item.id === student.id);
                            return (
                              <tr
                                key={student.id}
                                className={`border-b border-emerald-100 last:border-b-0 ${
                                  isSelected ? "bg-emerald-100/80" : "hover:bg-emerald-100"
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleStudentSelection(student)}
                                      className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div>
                                      <div className="font-semibold text-emerald-900">
                                        {student.firstName} {student.lastName}
                                      </div>
                                      <div className="text-xs text-emerald-700">{maskTc(student.tcKimlikNo)}</div>
                                      {(student.phone || student.email) && (
                                        <div className="text-xs text-emerald-500">
                                          {student.phone || "-"} / {student.email || "-"}
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {!availableStudentsLoading && studentQuery.trim() && (
                    <p className="text-xs text-gray-500">
                      {filteredAvailableStudents.length} kursiyer görüntüleniyor (toplam {availableStudents.length}).
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Seçili Kursiyerler ({selectedStudents.length})
                  </label>
                  {selectedStudents.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500 border border-emerald-100 rounded-xl bg-gray-50">
                      Henüz kursiyer seçmediniz.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedStudents.map((student) => (
                        <div
                          key={student.id}
                          className="px-4 py-3 border border-emerald-200 rounded-xl bg-white text-sm text-emerald-700 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold">
                              {student.firstName} {student.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{maskTc(student.tcKimlikNo)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudents((prev) => prev.filter((item) => item.id !== student.id))
                            }
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Kaldır
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kayıt Durumu</label>
                  <select
                    value={assignStatus}
                    onChange={(e) => setAssignStatus(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="active">Aktif</option>
                    <option value="pending">Beklemede</option>
                    <option value="completed">Tamamlandı</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-gray-500">
                    Seçilen kursiyerler bu kursa ve sınıf kartına atanır. Gerekirse durum bilgisini sonradan güncelleyebilirsiniz.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => {
                    setAssignModalOpen(false);
                    setAssignError("");
                  }}
                  className="px-5 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 font-medium shadow-lg disabled:opacity-50"
                >
                  {assignSubmitting ? "Kaydediliyor..." : "Kursiyerleri Ata"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


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
                    placeholder="Örn: Ulaştırma Mevzuatı"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  Belirlediğiniz gün ve saatlerde seçili tarih aralığı için otomatik oturumlar
                  oluşturulur.
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

      {instructorManagerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Eğitmen Yönetimi</h3>
                <p className="text-xs text-gray-500">
                  Ders programında kullanmak için eğitmenleri ekleyin ve mevcut eğitmenleri görüntüleyin.
                </p>
              </div>
              <button
                onClick={() => {
                  setInstructorManagerOpen(false);
                  setCreateInstructorError("");
                  setCreateInstructorSuccess("");
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Kayıtlı Eğitmenler</h4>
                {instructorsLoading ? (
                  <div className="text-sm text-gray-500">Eğitmen listesi yükleniyor...</div>
                ) : instructors.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Henüz eğitmen bulunmuyor. Aşağıdaki formu kullanarak yeni eğitmen ekleyebilirsiniz.
                </div>
              ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Ad Soyad
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Kullanıcı Adı
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            E-posta
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Rol
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {instructors.map((instructor) => (
                          <tr key={instructor.id}>
                            <td className="px-4 py-2 text-gray-700">{instructor.fullName}</td>
                            <td className="px-4 py-2 text-gray-700">{instructor.username}</td>
                            <td className="px-4 py-2 text-gray-700">
                              {instructor.email || <span className="text-gray-400">Belirtilmemiş</span>}
                            </td>
                            <td className="px-4 py-2">
                              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                                {instructor.role === "EgitimYoneticisi" ? "Eğitim Yöneticisi" : "Eğitmen"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Yeni Eğitmen Ekle</h4>
                {createInstructorError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-3">
                    {createInstructorError}
            </div>
                )}
                {createInstructorSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-3">
                    {createInstructorSuccess}
          </div>
                )}

                <form onSubmit={handleCreateInstructor} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ad Soyad</label>
                    <input
                      type="text"
                      value={instructorForm.fullName}
                      onChange={(e) => setInstructorForm({ ...instructorForm, fullName: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Örn: Ahmet Yılmaz"
                    />
        </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={instructorForm.username}
                      onChange={(e) => setInstructorForm({ ...instructorForm, username: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Örn: ayilmaz"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">E-posta (opsiyonel)</label>
                    <input
                      type="email"
                      value={instructorForm.email}
                      onChange={(e) => setInstructorForm({ ...instructorForm, email: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Örn: ayilmaz@src.local"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Şifre</label>
                    <input
                      type="password"
                      value={instructorForm.password}
                      onChange={(e) => setInstructorForm({ ...instructorForm, password: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="En az 6 karakter"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
                    <select
                      value={instructorForm.role}
                      onChange={(e) => setInstructorForm({ ...instructorForm, role: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="Egitmen">Eğitmen</option>
                      <option value="EgitimYoneticisi">Eğitim Yöneticisi</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInstructorForm({
                          fullName: "",
                          username: "",
                          email: "",
                          password: "",
                          role: "Egitmen",
                        });
                        setCreateInstructorError("");
                        setCreateInstructorSuccess("");
                      }}
                      className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Temizle
                    </button>
                    <button
                      type="submit"
                      disabled={createInstructorSubmitting}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium shadow disabled:opacity-50"
                    >
                      {createInstructorSubmitting ? "Kaydediliyor..." : "Eğitmen Ekle"}
                    </button>
                  </div>
                </form>
                <p className="text-xs text-gray-500 mt-3">
                  Not: Eklediğiniz eğitmenler sisteme giriş yapabilir ve ders programlarında tercih edebilirsiniz.
                  Eğitim yöneticileri ders planlama dışında yönetim yetkilerine de sahip olur.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  gradient,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  gradient: string;
  icon: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br ${gradient} overflow-hidden shadow-xl rounded-xl transform hover:scale-105 transition-transform duration-200`}
    >
      <div className="p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/80 uppercase tracking-wide">{title}</div>
            <div className="text-3xl font-bold mt-2">{value}</div>
            {subtitle && <div className="text-sm text-white/70 mt-2">{subtitle}</div>}
          </div>
          <div className="text-5xl opacity-20">{icon}</div>
        </div>
      </div>
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

function TabButton({
  tab,
  label,
  activeTab,
  onClick,
}: {
  tab: TabKey;
  label: string;
  activeTab: TabKey;
  onClick: (tab: TabKey) => void;
}) {
  const isActive = activeTab === tab;
  return (
    <button
      onClick={() => onClick(tab)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive ? "bg-green-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center border border-dashed border-gray-200 rounded-xl text-gray-500 bg-gray-50">
      {message}
    </div>
  );
}

