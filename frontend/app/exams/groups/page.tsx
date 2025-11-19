"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

type ViewMode = "results" | "eligible";

interface ClassSummary {
  id: number;
  year: number;
  month: number;
  groupNo: number;
  branch?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  name: string;
}

interface GroupInfo {
  id: number;
  year: number;
  month: number;
  groupNo: number;
  branch?: string | null;
  startDate: string;
  endDate: string;
  name: string;
}

interface GroupExamResultItem {
  examId: number;
  courseId: number;
  courseName: string;
  examType: string;
  examDate: string;
  studentId: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  score?: number | null;
  pass: boolean;
  attemptNo?: number | null;
  notes?: string | null;
}

interface GroupExamResultSummary {
  totalStudents: number;
  writtenPassCount: number;
  writtenFailCount: number;
  practicalPassCount: number;
  practicalFailCount: number;
  practicalEligibleCount: number;
  graduatedCount: number;
}

interface GroupExamResultsResponse {
  group: GroupInfo;
  written: GroupExamResultItem[];
  practical: GroupExamResultItem[];
  summary: GroupExamResultSummary;
}

interface PracticalEligibility {
  studentId: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  courseId: number;
  courseName: string;
  writtenPassed: boolean;
  writtenExamDate?: string | null;
  writtenScore?: number | null;
  practicalPassed: boolean;
  practicalExamDate?: string | null;
  practicalScore?: number | null;
}

type SummaryTone = "indigo" | "blue" | "teal" | "amber" | "emerald";

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

const formatDate = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
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

const examTypeLabel = (type: string) => {
  const normalized = type.trim().toLowerCase();
  if (normalized === "written" || normalized === "yazili" || normalized === "yazılı") {
    return "Yazılı";
  }
  if (normalized === "practical" || normalized === "uygulama" || normalized === "pratik") {
    return "Pratik";
  }
  return type;
};

export default function ExamGroupResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchGroupParam = searchParams?.get("groupId");
  const parsedSearchGroupId = searchGroupParam ? Number(searchGroupParam) : null;
  const initialGroupId = parsedSearchGroupId && !Number.isNaN(parsedSearchGroupId) ? parsedSearchGroupId : null;
  const initialViewParam = searchParams?.get("view");

  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classError, setClassError] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(initialGroupId);
  const [view, setView] = useState<ViewMode>(
    initialViewParam === "eligible" ? "eligible" : "results"
  );

  const [groupResults, setGroupResults] = useState<GroupExamResultsResponse | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");

  const [eligibleMap, setEligibleMap] = useState<Record<number, PracticalEligibility[]>>({});
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleError, setEligibleError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me")
      .then(() => setAuthorized(true))
      .catch(() => router.push("/login"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  useEffect(() => {
    if (!authorized) return;

    const loadClasses = async () => {
      try {
        setClassError("");
        const response = await api.get<ClassSummary[]>("/courses/groups?status=active");
        const data = (response.data || []).filter(
          (item) => !item.status || item.status.toLowerCase() !== "inactive"
        );
        setClasses(data);
      } catch (err: any) {
        console.error("Class load error:", err);
        const message =
          err.response?.data?.message ||
          err.message ||
          "Sınıf listesi yüklenirken bir hata oluştu.";
        setClassError(message);
        setClasses([]);
      }
    };

    loadClasses();
  }, [authorized]);

  useEffect(() => {
    if (!classes.length) return;

    setSelectedGroupId((current) => {
      if (current && classes.some((item) => item.id === current)) {
        return current;
      }
      if (initialGroupId && classes.some((item) => item.id === initialGroupId)) {
        return initialGroupId;
      }
      return classes[0]?.id ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes]);

  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      const yearMatches = selectedYear === "all" || item.year === Number(selectedYear);
      const monthMatches = selectedMonth === "all" || item.month === Number(selectedMonth);
      const branchNormalized = item.branch ? item.branch.trim().toLowerCase() : "merkez";
      const branchFilterNormalized =
        selectedBranch === "all" ? null : selectedBranch.trim().toLowerCase();
      const branchMatches =
        branchFilterNormalized === null || branchNormalized === branchFilterNormalized;
      return yearMatches && monthMatches && branchMatches;
    });
  }, [classes, selectedYear, selectedMonth, selectedBranch]);

  useEffect(() => {
    if (!filteredClasses.length) {
      setSelectedGroupId(null);
      return;
    }

    setSelectedGroupId((current) => {
      if (current && filteredClasses.some((item) => item.id === current)) {
        return current;
      }
      return filteredClasses[0].id;
    });
  }, [filteredClasses]);

  useEffect(() => {
    if (!authorized) return;
    const params = new URLSearchParams();
    if (selectedGroupId) {
      params.set("groupId", String(selectedGroupId));
    }
    if (view === "eligible") {
      params.set("view", "eligible");
    }
    const query = params.toString();
    router.replace(`/exams/groups${query ? `?${query}` : ""}`);
  }, [authorized, router, selectedGroupId, view]);

  const loadGroupResults = async (groupId: number) => {
    try {
      setResultsLoading(true);
      setResultsError("");
      const response = await api.get<GroupExamResultsResponse>(
        `/exams/groups/${groupId}/results`
      );
      setGroupResults(response.data);
    } catch (err: any) {
      console.error("Group results load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Sınav sonuçları yüklenirken bir hata oluştu.";
      setResultsError(message);
      setGroupResults(null);
    } finally {
      setResultsLoading(false);
    }
  };

  const loadEligible = async (groupId: number) => {
    if (eligibleMap[groupId]) return;
    try {
      setEligibleLoading(true);
      setEligibleError("");
      const response = await api.get<PracticalEligibility[]>(
        `/exams/groups/${groupId}/practical-eligible`
      );
      setEligibleMap((prev) => ({
        ...prev,
        [groupId]: response.data || [],
      }));
    } catch (err: any) {
      console.error("Practical eligible load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Pratik sınava hak kazananlar yüklenirken bir hata oluştu.";
      setEligibleError(message);
    } finally {
      setEligibleLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized || !selectedGroupId) return;
    loadGroupResults(selectedGroupId);
  }, [authorized, selectedGroupId]);

  useEffect(() => {
    if (!authorized || !selectedGroupId) return;
    if (view === "eligible") {
      void loadEligible(selectedGroupId);
    }
  }, [authorized, selectedGroupId, view]);

  const yearOptions = useMemo(() => {
    const unique = new Set<number>();
    classes.forEach((item) => unique.add(item.year));
    return Array.from(unique).sort((a, b) => b - a);
  }, [classes]);

  const branchOptions = useMemo(() => {
    const unique = new Set<string>();
    classes.forEach((item) => {
      const value = item.branch ? item.branch.trim() : "Merkez";
      unique.add(value);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [classes]);

  const currentEligible = selectedGroupId ? eligibleMap[selectedGroupId] || [] : [];
  const currentClass = selectedGroupId
    ? classes.find((item) => item.id === selectedGroupId)
    : undefined;

  const handleExportGraduates = async () => {
    if (!selectedGroupId) return;
    try {
      setExporting(true);
      setExportError("");
      const response = await api.get(`/exams/groups/${selectedGroupId}/graduates/export`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName =
        groupResults?.group?.name
          ? `${groupResults.group.name.replace(/\s+/g, "_").toLowerCase()}_mezunlar.csv`
          : "mezunlar.csv";
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Graduate export error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Mezun listesi dışa aktarılırken bir hata oluştu.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Yetki doğrulanıyor...</div>
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
                onClick={() => router.push("/exams")}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← Sınav Listesi
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">📚</span>
                Sınıf Bazlı Sınav Sonuçları
              </h1>
            </div>
            <div className="text-sm text-gray-500 max-w-2xl">
              Yazılı ve pratik sınav sonuçlarını sınıf bazında inceleyin, pratik sınava hak kazananları
              takip edin ve mezun listelerini dışa aktarın.
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-6">
        <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sınıf Seçimi</h2>
              <p className="text-sm text-gray-600">
                Yıl, ay ve şube filtrelerini kullanarak sınıfı seçin. Sonuçlar seçili sınıfa göre
                listelenir.
              </p>
            </div>
          </div>
          {classError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {classError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Yıl</label>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="w-full px-3 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tümü</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ay</label>
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="w-full px-3 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tümü</option>
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Şube</label>
              <select
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                className="w-full px-3 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tümü</option>
                {branchOptions.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Sınıf</label>
              <select
                value={selectedGroupId ?? ""}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedGroupId(Number.isNaN(value) ? null : value);
                }}
                className="w-full px-3 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {filteredClasses.length === 0 ? (
                  <option value="">Uygun sınıf bulunamadı</option>
                ) : (
                  filteredClasses.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-100 shadow-xl rounded-xl">
          {resultsLoading ? (
            <div className="px-6 py-16 text-center text-gray-600">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
              Sınav sonuçları yükleniyor...
            </div>
          ) : resultsError ? (
            <div className="px-6 py-10 text-center text-red-600 font-medium">{resultsError}</div>
          ) : !groupResults ? (
            <div className="px-6 py-10 text-center text-gray-500">
              Bir sınıf seçerek sınav sonuçlarını görüntüleyin.
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {groupResults.group.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {formatDate(groupResults.group.startDate)} - {formatDate(groupResults.group.endDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setView(view === "results" ? "eligible" : "results")}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    {view === "results"
                      ? "Pratik Sınava Hak Kazananları Gör"
                      : "Sınav Sonuçlarına Dön"}
                  </button>
                  <button
                    onClick={handleExportGraduates}
                    disabled={exporting || !groupResults.summary.graduatedCount}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg shadow hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {exporting ? "Dışa aktarılıyor..." : "Mezunları CSV Olarak İndir"}
                  </button>
                </div>
              </div>
              {exportError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {exportError}
                </div>
              )}

              {view === "results" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard
                      title="Toplam Kursiyer"
                      value={groupResults.summary.totalStudents}
                      tone="indigo"
                    />
                    <SummaryCard
                      title="Yazılı Sınav"
                      value={`${groupResults.summary.writtenPassCount} Geçti / ${groupResults.summary.writtenFailCount} Kaldı`}
                      tone="blue"
                    />
                    <SummaryCard
                      title="Pratik Sınav"
                      value={`${groupResults.summary.practicalPassCount} Geçti / ${groupResults.summary.practicalFailCount} Kaldı`}
                      tone="teal"
                    />
                    <SummaryCard
                      title="Pratik Hak Kazanan"
                      value={groupResults.summary.practicalEligibleCount}
                      tone="amber"
                    />
                    <SummaryCard
                      title="Mezun Sayısı"
                      value={groupResults.summary.graduatedCount}
                      tone="emerald"
                    />
                  </div>

                  <ResultTable
                    title="Yazılı Sınav Sonuçları"
                    items={groupResults.written}
                    emptyMessage="Bu sınıf için yazılı sınav sonucu bulunamadı."
                  />

                  <ResultTable
                    title="Pratik Sınav Sonuçları"
                    items={groupResults.practical}
                    emptyMessage="Bu sınıf için pratik sınav sonucu bulunamadı."
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Pratik Sınava Hak Kazanan Kursiyerler
                    </h3>
                    {eligibleLoading && (
                      <div className="text-sm text-indigo-600 animate-pulse">
                        Liste güncelleniyor...
                      </div>
                    )}
                  </div>
                  {eligibleError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {eligibleError}
                    </div>
                  )}
                  {eligibleLoading && !currentEligible.length ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                      Pratik sınava hak kazananlar yükleniyor...
                    </div>
                  ) : currentEligible.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                      Henüz yazılı sınavı geçmiş kursiyer bulunmuyor.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Kursiyer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Yazılı Sınav
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Pratik Sınav
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentEligible.map((item) => (
                            <tr key={item.studentId}>
                              <td className="px-6 py-4">
                                <div className="text-sm font-semibold text-gray-900">
                                  {item.firstName} {item.lastName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {item.tcKimlikNo} • {item.courseName}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      item.writtenPassed
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {item.writtenPassed ? "Geçti" : "Bekliyor"}
                                  </span>
                                  {typeof item.writtenScore === "number" && (
                                    <span className="text-xs text-gray-500">
                                      Not: {item.writtenScore.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatDateTime(item.writtenExamDate)}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      item.practicalPassed
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {item.practicalPassed ? "Geçti" : "Sınav Bekleniyor"}
                                  </span>
                                  {typeof item.practicalScore === "number" && (
                                    <span className="text-xs text-gray-500">
                                      Not: {item.practicalScore.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {item.practicalExamDate
                                    ? formatDateTime(item.practicalExamDate)
                                    : "Tarih belirlenmedi"}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {currentClass && (
          <section className="bg-white border border-gray-100 shadow-lg rounded-xl p-6 text-sm text-gray-600">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Sınıf Özeti</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Dönem</div>
                <div className="text-sm font-medium text-gray-800">
                  {currentClass.year} {MONTH_OPTIONS.find((m) => m.value === currentClass.month)?.label}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Şube</div>
                <div className="text-sm font-medium text-gray-800">
                  {currentClass.branch || "Merkez"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">Tarih Aralığı</div>
                <div className="text-sm font-medium text-gray-800">
                  {formatDate(currentClass.startDate)} - {formatDate(currentClass.endDate)}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string | number; tone: SummaryTone }) {
  const toneClasses: Record<SummaryTone, string> = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-800",
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    teal: "bg-teal-50 border-teal-100 text-teal-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
  };

  return (
    <div className={`p-4 border rounded-xl shadow-sm ${toneClasses[tone]}`}>
      <div className="text-xs uppercase tracking-wide font-semibold">{title}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

function ResultTable({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: GroupExamResultItem[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="text-xs text-gray-400">
          {items.length
            ? `${items.length} kayıt`
            : "Kayıt bulunamadı"}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kursiyer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Sınav
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Sonuç
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={`${item.examId}-${item.studentId}-${item.attemptNo ?? 0}`}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {item.firstName} {item.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.tcKimlikNo} • {item.courseName}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="font-semibold text-indigo-700">{examTypeLabel(item.examType)}</div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(item.examDate)} • Deneme {item.attemptNo ?? 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          item.pass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.pass ? "Geçti" : "Kaldı"}
                      </span>
                      {typeof item.score === "number" && (
                        <span className="text-xs text-gray-500">Not: {item.score.toFixed(2)}</span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-500 mt-1">Not: {item.notes}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

