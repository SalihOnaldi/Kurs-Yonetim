"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type PaymentStatusFilter = "all" | "pending" | "paid" | "cancelled";

interface PaymentListItem {
  id: number;
  amount: number;
  penaltyAmount?: number | null;
  paymentType: string;
  status: string;
  dueDate: string;
  paidDate?: string | null;
  receiptNo?: string | null;
  description?: string | null;
  enrollmentId?: number | null;
  student: {
    id: number;
    tcKimlikNo: string;
    firstName: string;
    lastName: string;
  };
  groupInfo?: {
    id: number;
    srcType: number;
    groupNo: number;
    branch?: string | null;
  } | null;
}

export default function PaymentsPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [listError, setListError] = useState("");

  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [studentFilter, setStudentFilter] = useState<string>("");
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
    loadPayments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    loadPayments(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentTypeFilter, branchFilter, courseFilter, studentFilter]);

  const loadPayments = async (initial: boolean) => {
    try {
      if (initial) setLoading(true);
      else setFetching(true);

      setListError("");
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (paymentTypeFilter !== "all") params.append("paymentType", paymentTypeFilter);
      if (branchFilter.trim()) params.append("branch", branchFilter.trim());
      if (courseFilter.trim()) params.append("mebGroupId", courseFilter.trim());
      if (studentFilter.trim()) params.append("studentId", studentFilter.trim());

      const response = await api.get<PaymentListItem[]>(
        `/payments${params.size ? `?${params.toString()}` : ""}`
      );
      setPayments(response.data || []);
    } catch (err: any) {
      console.error("Payments load error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Ödeme listesi yüklenirken bir hata oluştu.";
      setListError(message);
    } finally {
      if (initial) setLoading(false);
      setFetching(false);
    }
  };

  const totalPending = useMemo(() => {
    return payments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amount + (p.penaltyAmount ?? 0), 0);
  }, [payments]);

  const totalPaid = useMemo(() => {
    return payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount + (p.penaltyAmount ?? 0), 0);
  }, [payments]);

  const formatCurrency = (value: number | undefined | null) => {
    const amount = value ?? 0;
    return amount.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      });
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

  const paymentTypeText = (type: string) => {
    switch (type) {
      case "course_fee":
        return "Kurs Ücreti";
      case "exam_fee":
        return "Sınav Ücreti";
      default:
        return "Diğer";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "cancelled":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const handleMarkAsPaid = async (payment: PaymentListItem) => {
    if (
      !confirm(
        `${payment.student.firstName} ${payment.student.lastName} adına ${formatCurrency(
          payment.amount + (payment.penaltyAmount ?? 0)
        )} tutarındaki ödemeyi "ödendi" olarak işaretlemek istiyor musunuz?`
      )
    ) {
      return;
    }

    try {
      await api.put(`/payments/${payment.id}/pay`, {
        paidDate: new Date().toISOString(),
        receiptNo: payment.receiptNo,
      });
      loadPayments(false);
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Ödeme güncellenirken bir hata oluştu.";
      alert(message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Ödeme listesi yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <nav className="bg-white shadow-lg border-b-2 border-orange-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-orange-600 hover:text-orange-800 font-medium"
              >
                ← Ana Sayfa
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">💰</span>
                Ödeme Yönetimi
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard
              title="Toplam Bekleyen Tutar"
              value={formatCurrency(totalPending)}
              gradient="from-orange-500 to-orange-600"
              icon="⏳"
            />
            <SummaryCard
              title="Toplam Tahsilat"
              value={formatCurrency(totalPaid)}
              gradient="from-green-500 to-green-600"
              icon="✅"
            />
            <SummaryCard
              title="Ödeme Kaydı"
              value={payments.length}
              gradient="from-blue-500 to-blue-600"
              icon="📄"
            />
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between md:justify-start md:space-x-4">
              <h3 className="text-sm font-semibold text-gray-900 md:text-base">Filtreler</h3>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="md:hidden px-3 py-1 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Göster"}
              </button>
            </div>
            <div
              className={`${filtersOpen ? "grid mt-4" : "hidden"} md:grid grid-cols-1 md:grid-cols-5 gap-4`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Durum</label>
            <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PaymentStatusFilter)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tümü</option>
              <option value="pending">Bekleyen</option>
              <option value="paid">Ödenen</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ödeme Tipi
                </label>
                <select
                  value={paymentTypeFilter}
                  onChange={(e) => setPaymentTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Tümü</option>
                  <option value="course_fee">Kurs Ücreti</option>
                  <option value="exam_fee">Sınav Ücreti</option>
                  <option value="other">Diğer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Şube
                </label>
                <input
                  type="text"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  placeholder="Şube adı..."
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            {listError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {listError}
              </div>
            )}
            {fetching && (
              <div className="text-sm text-orange-600 animate-pulse">Liste güncelleniyor...</div>
            )}
            {!filtersOpen && (
              <div className="text-xs text-gray-500 md:hidden">
                Filtre alanını görüntülemek için butonu kullanın.
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
            {payments.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                Ödeme kaydı bulunamadı. Filtreleri değiştirerek tekrar deneyin.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="px-6 py-4 hover:bg-orange-50 transition-colors duration-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {payment.student.firstName} {payment.student.lastName}
                            {payment.groupInfo && (
                              <>
                                {" "}
                                • SRC{payment.groupInfo.srcType} Grup {payment.groupInfo.groupNo}
                                {payment.groupInfo.branch ? ` (${payment.groupInfo.branch})` : ""}
                              </>
                            )}
                          </h3>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadge(
                              payment.status
                            )}`}
                          >
                            {payment.status === "paid"
                              ? "Ödendi"
                              : payment.status === "pending"
                              ? "Bekliyor"
                              : "İptal"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Tutar:</span>{" "}
                            {formatCurrency(payment.amount)}
                          </div>
                          <div>
                            <span className="font-medium">Ceza:</span>{" "}
                            {formatCurrency(payment.penaltyAmount)}
                          </div>
                          <div>
                            <span className="font-medium">Vade:</span>{" "}
                            {formatDate(payment.dueDate)}
                          </div>
                          <div>
                            <span className="font-medium">Tip:</span>{" "}
                            {paymentTypeText(payment.paymentType)}
                          </div>
                          <div>
                            <span className="font-medium">Ödeme Tarihi:</span>{" "}
                            {formatDate(payment.paidDate)}
                          </div>
                          <div>
                            <span className="font-medium">Dekont No:</span>{" "}
                            {payment.receiptNo || "-"}
                          </div>
                            <div>
                            <span className="font-medium">Kursiyer TC:</span>{" "}
                            {maskTc(payment.student.tcKimlikNo)}
                            </div>
                        </div>
                        {payment.description && (
                          <div className="mt-2 text-sm text-gray-500">
                            <span className="font-medium">Açıklama:</span> {payment.description}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {payment.status === "pending" && (
                          <button
                            onClick={() => handleMarkAsPaid(payment)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-green-50 transition-colors"
                          >
                            ✅ Ödendi İşaretle
                          </button>
                        )}
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

function SummaryCard({
  title,
  value,
  gradient,
  icon,
}: {
  title: string;
  value: string | number;
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
          </div>
          <div className="text-5xl opacity-20">{icon}</div>
        </div>
      </div>
    </div>
  );
}

