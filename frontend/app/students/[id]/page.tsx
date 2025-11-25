"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

type TabKey = "overview" | "documents" | "enrollments" | "payments";

interface StudentDetailDto {
  profile: StudentProfile;
  documents: StudentDocument[];
  enrollments: StudentEnrollment[];
  payments: StudentPayment[];
  outstandingBalance: number;
}

interface StudentProfile {
  id: number;
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
  createdAt: string;
}

interface StudentDocument {
  id: number;
  studentId: number;
  documentType: string;
  fileUrl: string;
  docNo?: string;
  docDate?: string;
  ocrConfidence?: number;
  isRequired: boolean;
  validationStatus: string;
  validationNotes?: string;
  createdAt: string;
}

interface StudentEnrollment {
  enrollmentId: number;
  mebGroupId: number;
  courseName: string;
  status: string;
  enrollmentDate: string;
  srcType: number;
  group: {
    year: number;
    month: number;
    groupNo: number;
    branch?: string | null;
    startDate: string;
    endDate: string;
  };
  isActive: boolean;
  examAttemptCount?: number | null;
}

interface StudentPayment {
  paymentId: number;
  amount: number;
  penaltyAmount?: number | null;
  paymentType: string;
  status: string;
  dueDate: string;
  paidDate?: string | null;
  receiptNo?: string | null;
  description?: string | null;
  enrollmentId?: number | null;
  enrollment?: {
    mebGroupId: number;
    courseName: string;
    group: {
      year: number;
      month: number;
      groupNo: number;
      branch?: string | null;
      startDate: string;
      endDate: string;
    };
    srcType: number;
  } | null;
}

interface PaymentDefaults {
  autoCreateOnStudentCreate: boolean;
  amount: number;
  paymentType: string;
  dueDays: number;
  penaltyAmount?: number | null;
  description?: string | null;
}

const DOCUMENT_TYPES = [
  { value: "adli_sicil", label: "Adli Sicil Kaydı" },
  { value: "kimlik", label: "Kimlik Fotokopisi" },
  { value: "ehliyet", label: "Ehliyet Fotokopisi" },
  { value: "saglik", label: "Sağlık Raporu" },
  { value: "ikametgah", label: "İkametgah" },
  { value: "mezuniyet", label: "Diploma / Mezuniyet" },
  { value: "foto", label: "Biyometrik Fotoğraf" },
  { value: "sözleşme", label: "Sözleşme" },
  { value: "diger", label: "Diğer" },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "course_fee", label: "Kurs Ücreti" },
  { value: "exam_fee", label: "Sınav Ücreti" },
  { value: "other", label: "Diğer" },
];

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentIdParam = params?.id;
  const studentId = Number(studentIdParam);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<StudentDetailDto | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [uploading, setUploading] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [paymentDefaults, setPaymentDefaults] = useState<PaymentDefaults | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentFormMode, setPaymentFormMode] = useState<"create" | "edit">("create");
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    dueDate: "",
    paymentType: "course_fee",
    penaltyAmount: "",
    description: "",
    enrollmentId: "",
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    educationLevel: "",
    licenseType: "",
    licenseIssueDate: "",
  });

  useEffect(() => {
    if (!studentId || Number.isNaN(studentId)) {
      router.push("/students");
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me")
      .then(() => {
        fetchDetail();
        loadPaymentDefaults();
      })
      .catch(() => {
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchDetail = () => {
    setLoading(true);
    setError("");

    api
      .get<StudentDetailDto>(`/students/${studentId}`)
      .then((response) => {
        setDetail(response.data);
      })
      .catch((err: any) => {
        console.error("Student detail error:", err);
        const message =
          err.response?.data?.message ||
          err.message ||
          "Kursiyer detayları yüklenirken bir hata oluştu.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const loadPaymentDefaults = () => {
    api
      .get<PaymentDefaults>("/payments/defaults")
      .then((response) => {
        setPaymentDefaults(response.data);
      })
      .catch((err: any) => {
        console.error("Payment defaults error:", err);
      });
  };

  const refreshDocuments = () => {
    api
      .get<StudentDocument[]>(`/students/${studentId}/documents`)
      .then((response) => {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                documents: response.data,
              }
            : prev
        );
      })
      .catch((err: any) => {
        console.error("Document list error:", err);
        const message =
          err.response?.data?.message || "Belgeler yüklenirken bir hata oluştu.";
        setDocumentError(message);
      });
  };

  const resetPaymentForm = (defaults: PaymentDefaults | null = paymentDefaults) => {
    setPaymentForm({
      amount: defaults?.amount ? defaults.amount.toString() : "",
      dueDate: computeDueDateValue(defaults?.dueDays),
      paymentType: defaults?.paymentType ?? "course_fee",
      penaltyAmount:
        defaults?.penaltyAmount !== undefined && defaults?.penaltyAmount !== null
          ? defaults.penaltyAmount.toString()
          : "",
      description: defaults?.description ?? "",
      enrollmentId: "",
    });
  };

  const toInputDateValue = (value?: string) => {
    if (!value) return "";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const openEditModal = () => {
    if (!detail?.profile) return;
    const profile = detail.profile;
    setEditForm({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      birthDate: toInputDateValue(profile.birthDate),
      phone: profile.phone ?? "",
      email: profile.email ?? "",
      address: profile.address ?? "",
      educationLevel: profile.educationLevel ?? "",
      licenseType: profile.licenseType ?? "",
      licenseIssueDate: toInputDateValue(profile.licenseIssueDate),
    });
    setEditError("");
    setEditSuccess("");
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (editSubmitting) return;
    setEditModalOpen(false);
    setEditError("");
    setEditSuccess("");
  };

  const handleEditFormChange =
    (field: keyof typeof editForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setEditForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditError("");
    setEditSuccess("");

    const firstName = editForm.firstName.trim();
    const lastName = editForm.lastName.trim();

    if (!firstName || !lastName) {
      setEditError("Ad ve soyad alanları zorunludur.");
      return;
    }

    const payload: Record<string, unknown> = {
      firstName,
      lastName,
    };

    const normalizeOptional = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : "";
    };

    payload.phone = editForm.phone ? normalizeOptional(editForm.phone) : "";
    payload.email = editForm.email ? normalizeOptional(editForm.email) : "";
    payload.address = editForm.address ? normalizeOptional(editForm.address) : "";
    payload.educationLevel = editForm.educationLevel
      ? normalizeOptional(editForm.educationLevel)
      : "";
    payload.licenseType = editForm.licenseType ? normalizeOptional(editForm.licenseType) : "";

    if (editForm.birthDate) {
      const birth = new Date(editForm.birthDate);
      if (Number.isNaN(birth.getTime())) {
        setEditError("Geçerli bir doğum tarihi seçin.");
        return;
      }
      payload.birthDate = birth.toISOString();
    }

    if (editForm.licenseIssueDate) {
      const license = new Date(editForm.licenseIssueDate);
      if (Number.isNaN(license.getTime())) {
        setEditError("Geçerli bir ehliyet veriliş tarihi seçin.");
        return;
      }
      payload.licenseIssueDate = license.toISOString();
    }

    setEditSubmitting(true);

    try {
      await api.put(`/students/${studentId}`, payload);
      setEditSuccess("Kursiyer bilgileri güncellendi.");
      fetchDetail();
      setTimeout(() => {
        setEditSubmitting(false);
        setEditModalOpen(false);
      }, 600);
    } catch (err: any) {
      console.error("Student update error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Kursiyer bilgileri güncellenirken bir hata oluştu.";
      setEditError(message);
      setEditSubmitting(false);
    }
  };

  const openCreatePaymentModal = () => {
    setPaymentFormMode("create");
    setEditingPaymentId(null);
    setPaymentError("");
    resetPaymentForm();
    setPaymentModalOpen(true);
  };

  const openEditPaymentModal = (payment: StudentPayment) => {
    setPaymentFormMode("edit");
    setEditingPaymentId(payment.paymentId);
    setPaymentError("");
    setPaymentForm({
      amount: payment.amount.toString(),
      dueDate: toInputDate(payment.dueDate),
      paymentType: payment.paymentType,
      penaltyAmount:
        payment.penaltyAmount !== undefined && payment.penaltyAmount !== null
          ? payment.penaltyAmount.toString()
          : "",
      description: payment.description ?? "",
      enrollmentId: payment.enrollmentId ? payment.enrollmentId.toString() : "",
    });
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setPaymentError("");
    setEditingPaymentId(null);
  };

  const handleSubmitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentError("");

    if (!paymentForm.amount || Number.isNaN(Number(paymentForm.amount))) {
      setPaymentError("Lütfen geçerli bir tutar girin.");
      return;
    }

    if (!paymentForm.dueDate) {
      setPaymentError("Son ödeme tarihini seçin.");
      return;
    }

    const payload: any = {
      amount: Number(paymentForm.amount),
      dueDate: new Date(paymentForm.dueDate).toISOString(),
      paymentType: paymentForm.paymentType,
    };

    if (paymentForm.penaltyAmount) {
      payload.penaltyAmount = Number(paymentForm.penaltyAmount);
    }

    if (paymentForm.description?.trim()) {
      payload.description = paymentForm.description.trim();
    } else if (paymentFormMode === "edit") {
      payload.description = paymentForm.description?.trim() ?? "";
    }

    if (paymentForm.enrollmentId) {
      payload.enrollmentId = parseInt(paymentForm.enrollmentId, 10);
    } else if (paymentFormMode === "edit") {
      payload.enrollmentId = null;
    }

    setPaymentSubmitting(true);

    try {
      if (paymentFormMode === "edit" && editingPaymentId) {
        await api.put(`/payments/${editingPaymentId}`, payload);
      } else {
        await api.post(`/payments/students/${studentId}/apply-default`, payload);
      }
      closePaymentModal();
      fetchDetail();
    } catch (err: any) {
      console.error("Payment save error:", err);
      const message =
        err.response?.data?.message || err.message || "Ödeme kaydedilirken hata oluştu.";
      setPaymentError(message);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (payment: StudentPayment) => {
    if (!confirm("Bu ödeme kaydını silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      await api.delete(`/payments/${payment.paymentId}`);
      fetchDetail();
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Ödeme silinirken hata oluştu.";
      alert(message);
    }
  };

  const handleMarkPaymentPaid = async (payment: StudentPayment) => {
    if (
      !confirm(
        `${payment.amount.toLocaleString("tr-TR", {
          style: "currency",
          currency: "TRY",
        })} tutarındaki ödemeyi "ödendi" olarak işaretlemek istiyor musunuz?`
      )
    ) {
      return;
    }

    try {
      await api.put(`/payments/${payment.paymentId}/pay`, {
        paidDate: new Date().toISOString(),
        receiptNo: payment.receiptNo,
      });
      fetchDetail();
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Ödeme güncellenirken hata oluştu.";
      alert(message);
    }
  };

  const handleDocumentUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDocumentType) {
      setDocumentError("Lütfen belge tipi seçin.");
      return;
    }
    if (!selectedFile) {
      setDocumentError("Lütfen yüklenecek dosyayı seçin.");
      return;
    }

    setUploading(true);
    setDocumentError("");

    try {
      const formData = new FormData();
      formData.append("documentType", selectedDocumentType);
      formData.append("file", selectedFile);

      await api.post(`/students/${studentId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSelectedDocumentType("");
      setSelectedFile(null);
      refreshDocuments();
    } catch (err: any) {
      console.error("Document upload error:", err);
      const message =
        err.response?.data?.message || "Belge yüklenirken bir hata oluştu.";
      setDocumentError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: StudentDocument) => {
    if (!confirm("Bu belgeyi silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      await api.delete(`/students/${studentId}/documents/${doc.id}`);
      refreshDocuments();
    } catch (err: any) {
      console.error("Document delete error:", err);
      const message =
        err.response?.data?.message || "Belge silinirken bir hata oluştu.";
      alert(message);
    }
  };

  const parseFileNameFromHeaders = (headers: any, fallback: string) => {
    const disposition = headers?.["content-disposition"] as string | undefined;
    if (disposition) {
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      const fileName = match?.[1] || match?.[2];
      if (fileName) {
        try {
          return decodeURIComponent(fileName);
        } catch {
          return fileName;
        }
      }
    }
    return fallback;
  };

  const fallbackFileName = (doc: StudentDocument) => {
    if (doc.fileUrl) {
      const parts = doc.fileUrl.split("/");
      const name = parts[parts.length - 1];
      if (name) return name;
    }
    return `${doc.documentType || "belge"}.dat`;
  };

  const handleDownloadDocument = async (doc: StudentDocument) => {
    setDownloadingDocId(doc.id);
    try {
      const response = await api.get(
        `/students/${studentId}/documents/${doc.id}/download`,
        { responseType: "blob" }
      );
      const fileName = parseFileNameFromHeaders(response.headers, fallbackFileName(doc));
      const contentType = response.headers?.["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Document download error:", err);
      const message =
        err.response?.data?.message || "Belge indirilirken bir hata oluştu.";
      alert(message);
    } finally {
      setDownloadingDocId(null);
    }
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

  const formatCurrency = (value: number | undefined | null) => {
    const amount = value ?? 0;
    return amount.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    });
  };

  const paymentTypeLabel = (type: string) => {
    const option = PAYMENT_TYPE_OPTIONS.find((item) => item.value === type);
    return option ? option.label : type;
  };

  const toInputDate = (iso?: string | null) => {
    if (!iso) return "";
    try {
      return iso.slice(0, 10);
    } catch {
      return "";
    }
  };

  const computeDueDateValue = (dueDays?: number) => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    if (typeof dueDays === "number" && !Number.isNaN(dueDays)) {
      base.setDate(base.getDate() + dueDays);
    }
    return base.toISOString().slice(0, 10);
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const documentStatusClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "pending":
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const tabItems: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Genel Bilgiler" },
    { key: "documents", label: "Evraklar" },
    { key: "enrollments", label: "Kurs Kayıtları" },
    { key: "payments", label: "Ödemeler" },
  ];

  const documentsSorted = useMemo(() => {
    return detail?.documents
      ? [...detail.documents].sort((a, b) =>
          a.documentType.localeCompare(b.documentType, "tr-TR")
        )
      : [];
  }, [detail?.documents]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <div className="text-lg text-gray-700 font-medium">Kursiyer bilgileri yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-lg bg-white border border-red-200 rounded-xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Kursiyer bilgileri alınamadı</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/students")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kursiyer listesine dön
          </button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { profile, outstandingBalance, enrollments, payments } = detail;
  const activeEnrollments = enrollments.filter((e) => e.isActive).length;
  const totalEnrollments = enrollments.length;
  const paidPayments = payments.filter((p) => p.status === "paid").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <nav className="bg-white shadow-lg border-b-2 border-blue-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
              >
                ← Geri
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2 text-2xl">👤</span>
                {profile.firstName} {profile.lastName}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="text-sm text-blue-600 font-semibold mb-1">TC Kimlik</div>
                <div className="text-lg font-bold text-blue-900">{maskTc(profile.tcKimlikNo)}</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                <div className="text-sm text-green-600 font-semibold mb-1">Aktif Kurs</div>
                <div className="text-lg font-bold text-green-900">
                  {activeEnrollments} / {totalEnrollments}
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="text-sm text-amber-600 font-semibold mb-1">Bekleyen Ödemeler</div>
                <div className="text-lg font-bold text-amber-900">
                  {formatCurrency(outstandingBalance)}
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <div className="text-sm text-purple-600 font-semibold mb-1">Ödenen Taksitler</div>
                <div className="text-lg font-bold text-purple-900">{paidPayments}</div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 shadow-xl rounded-xl p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    İletişim ve Genel Bilgiler
                  </h3>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition-colors"
                  >
                    Bilgileri Düzenle
                  </button>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-3">İletişim Bilgileri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailItem label="Ad Soyad">
                      {profile.firstName} {profile.lastName}
                    </DetailItem>
                    <DetailItem label="TC Kimlik">{maskTc(profile.tcKimlikNo)}</DetailItem>
                    <DetailItem label="Doğum Tarihi">{formatDate(profile.birthDate)}</DetailItem>
                    <DetailItem label="Telefon">{profile.phone || "-"}</DetailItem>
                    <DetailItem label="E-posta">{profile.email || "-"}</DetailItem>
                    <DetailItem label="Adres">{profile.address || "-"}</DetailItem>
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-3">
                    Eğitim ve Ehliyet Bilgileri
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailItem label="Eğitim Seviyesi">{profile.educationLevel || "-"}</DetailItem>
                    <DetailItem label="Ehliyet Tipi">{profile.licenseType || "-"}</DetailItem>
                    <DetailItem label="Ehliyet Veriliş Tarihi">
                      {formatDate(profile.licenseIssueDate)}
                    </DetailItem>
                    <DetailItem label="Kayıt Tarihi">
                      {formatDate(profile.createdAt)}
                    </DetailItem>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-6">
                <form
                  onSubmit={handleDocumentUpload}
                  className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Belge Tipi
                    </label>
                    <select
                      value={selectedDocumentType}
                      onChange={(e) => setSelectedDocumentType(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Seçiniz</option>
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dosya
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Dosya Seç
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-4 py-2 border-2 border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        Tarayıcıdan (Kamera) Çek
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Tarayıcı seçeneği bilgisayar veya mobil cihaz kameranızı kullanarak belgeyi anında çekmenizi sağlar.
                    </p>
                    {selectedFile && (
                      <div className="text-xs text-gray-600 mt-2">
                        Seçilen dosya: <span className="font-medium">{selectedFile.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-4 flex justify-end gap-2">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium shadow-lg disabled:opacity-50"
                    >
                      {uploading ? "Yükleniyor..." : "Belge Yükle"}
                    </button>
                  </div>
                </form>

                {documentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {documentError}
                  </div>
                )}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Yüklenen Belgeler</h3>
                    <button
                      onClick={refreshDocuments}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Yenile
                    </button>
                  </div>
                  {documentsSorted.length === 0 ? (
                    <div className="px-6 py-10 text-center text-gray-500">
                      Bu kursiyere ait belge bulunmamaktadır.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Belge
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Detay
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Durum
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              İşlemler
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documentsSorted.map((doc) => (
                            <tr key={doc.id}>
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900 capitalize">
                                {doc.documentType.replace(/_/g, " ")}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700 space-y-1">
                                <div>Yüklendi: {formatDate(doc.createdAt)}</div>
                                {doc.docNo && <div>Belge No: {doc.docNo}</div>}
                                {doc.docDate && <div>Belge Tarihi: {formatDate(doc.docDate)}</div>}
                                {doc.validationNotes && (
                                  <div className="text-xs text-purple-600">
                                    Not: {doc.validationNotes}
                                  </div>
                                )}
                                {typeof doc.ocrConfidence === "number" && (
                                  <div className="text-xs text-gray-500">
                                    OCR Güveni: %{Math.round(doc.ocrConfidence * 100)}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-3 py-1 text-xs font-semibold rounded-full ${documentStatusClass(
                                    doc.validationStatus
                                  )}`}
                                >
                                  {doc.validationStatus === "approved" && "Onaylandı"}
                                  {doc.validationStatus === "pending" && "Kontrol Bekliyor"}
                                  {doc.validationStatus === "rejected" && "Reddedildi"}
                                  {!["approved", "pending", "rejected"].includes(
                                    doc.validationStatus
                                  ) && doc.validationStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button
                                  onClick={() => handleDownloadDocument(doc)}
                                  disabled={downloadingDocId === doc.id}
                                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium disabled:text-gray-400"
                                >
                                  {downloadingDocId === doc.id ? "İndiriliyor..." : "İndir"}
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
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
              </div>
            )}

            {activeTab === "enrollments" && (
              <div className="space-y-4">
                {enrollments.length === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-500">
                    Bu kursiyerin kayıtlı olduğu kurs bulunmamaktadır.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Kurs
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Grup
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Durum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Sınav Hakları
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Kayıt Tarihi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {enrollments.map((enrollment) => (
                          <tr key={enrollment.enrollmentId}>
                            <td className="px-6 py-4 text-sm text-blue-700 font-semibold">
                              {enrollment.courseName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {enrollment.group.year}-{enrollment.group.month}-GRUP{" "}
                              {enrollment.group.groupNo}
                              {enrollment.group.branch ? ` (${enrollment.group.branch})` : ""}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadgeClass(
                                  enrollment.status
                                )}`}
                              >
                                {enrollment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {enrollment.examAttemptCount ?? 0} / 4
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDate(enrollment.enrollmentDate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "payments" && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    Varsayılan tutar:{" "}
                    <span className="font-semibold text-gray-800">
                      {paymentDefaults ? formatCurrency(paymentDefaults.amount) : "-"}
                    </span>{" "}
                    • Son tarih +{paymentDefaults?.dueDays ?? "-"} gün
                  </div>
                  <button
                    onClick={openCreatePaymentModal}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-medium shadow-md transition-transform transform hover:scale-105"
                  >
                    + Ödeme Oluştur
                  </button>
                </div>
                {payments.length === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-500">
                    Bu kursiyerin ödeme kaydı bulunmamaktadır.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tutar
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tip
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Durum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Son Tarih
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Ödeme Tarihi
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Kurs
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Açıklama
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            İşlemler
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map((payment) => (
                          <tr key={payment.paymentId}>
                            <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                              {formatCurrency(payment.amount + (payment.penaltyAmount ?? 0))}
                              {payment.penaltyAmount ? (
                                <span className="text-xs text-red-500 ml-2">
                                  (Ceza: {formatCurrency(payment.penaltyAmount)})
                                </span>
                              ) : null}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {paymentTypeLabel(payment.paymentType)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                  payment.status === "paid"
                                    ? "bg-green-100 text-green-700"
                                    : payment.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {payment.status === "paid"
                                  ? "Ödendi"
                                  : payment.status === "pending"
                                  ? "Bekliyor"
                                  : payment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDate(payment.dueDate)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {payment.paidDate ? formatDate(payment.paidDate) : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {payment.enrollment ? payment.enrollment.courseName : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              <div>{payment.description || "-"}</div>
                              {payment.receiptNo && (
                                <div className="text-xs text-gray-400">Dekont: {payment.receiptNo}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => openEditPaymentModal(payment)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                              >
                                Düzenle
                              </button>
                              {payment.status === "pending" && (
                                <button
                                  onClick={() => handleMarkPaymentPaid(payment)}
                                  className="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                  Ödendi
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePayment(payment)}
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
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-blue-900">Kursiyer Bilgilerini Düzenle</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                disabled={editSubmitting}
              >
                Kapat ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ad</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={handleEditFormChange("firstName")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Soyad</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={handleEditFormChange("lastName")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Doğum Tarihi</label>
                  <input
                    type="date"
                    value={editForm.birthDate}
                    onChange={handleEditFormChange("birthDate")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={handleEditFormChange("phone")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="05xx xxx xx xx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">E-posta</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={handleEditFormChange("email")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ornek@eposta.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Eğitim Seviyesi</label>
                  <input
                    type="text"
                    value={editForm.educationLevel}
                    onChange={handleEditFormChange("educationLevel")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Lise, Üniversite..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ehliyet Tipi</label>
                  <input
                    type="text"
                    value={editForm.licenseType}
                    onChange={handleEditFormChange("licenseType")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="B, C, D..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Ehliyet Veriliş Tarihi
                  </label>
                  <input
                    type="date"
                    value={editForm.licenseIssueDate}
                    onChange={handleEditFormChange("licenseIssueDate")}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Adres</label>
                <textarea
                  value={editForm.address}
                  onChange={handleEditFormChange("address")}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[90px]"
                  placeholder="Adres bilgisi"
                />
              </div>
              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
                  {editSuccess}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                  disabled={editSubmitting}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 disabled:opacity-70"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">
                {paymentFormMode === "edit" ? "Ödemeyi Düzenle" : "Yeni Ödeme Oluştur"}
              </h3>
              <button onClick={closePaymentModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{paymentError}</div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tutar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Son Tarih <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentForm.dueDate}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Tipi</label>
                  <select
                    value={paymentForm.paymentType}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {PAYMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ceza Tutarı</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentForm.penaltyAmount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, penaltyAmount: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Opsiyonel"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">İlişkili Kurs</label>
                  <select
                    value={paymentForm.enrollmentId}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, enrollmentId: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Seçiniz (opsiyonel)</option>
                    {enrollments.map((enrollment) => (
                      <option key={enrollment.enrollmentId} value={enrollment.enrollmentId}>
                        {enrollment.courseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-5 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 font-medium shadow-lg disabled:opacity-50"
                >
                  {paymentSubmitting ? "Kaydediliyor..." : paymentFormMode === "edit" ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

