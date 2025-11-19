"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

interface HqTenantUsageDto {
  tenantId: string;
  tenantName: string;
  totalStudents: number;
  activeStudents: number;
  lastStudentCreatedAt?: string;
  expireDate?: string;
  username?: string;
  city?: string;
}

interface HqLicenseSummaryDto {
  totalLicenses: number;
  expiringSoon: number;
  expired: number;
  createdThisMonth: number;
}

interface LicenseReminderLogDto {
  id: number;
  tenantId: string;
  tenantName: string;
  channel: string;
  recipient?: string;
  thresholdDays: number;
  createdAt: string;
  sentAt?: string;
  status: string;
  error?: string;
}

interface AuditLogDto {
  id: number;
  action: string;
  actorName: string;
  actorRole: string;
  tenantId?: string;
  entityType: string;
  entityId?: string;
  metadata?: string;
  createdAt: string;
}

interface LicenseCsvLogDto {
  id: number;
  action: string;
  actorName: string;
  createdAt: string;
  totalRows?: number;
  imported?: number;
  failed?: number;
  count?: number;
}

interface CsvSummaryDto {
  last7Days: Record<string, CsvSummaryPoint>;
  totalImports: number;
  totalExports: number;
}

interface CsvSummaryPoint {
  imports: number;
  exports: number;
}

interface TenantApiTokenDto {
  id: number;
  name: string;
  tokenPrefix: string;
  description?: string;
  permissions?: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  isRevoked: boolean;
  revokedAt?: string;
  createdByName?: string;
  revokedByName?: string;
}

interface CreateTenantApiTokenResponse {
  token: TenantApiTokenDto;
  plainToken: string;
}

type ApiErrorResponse = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

interface LicenseImportResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: LicenseImportError[];
}

interface LicenseImportError {
  rowNumber: number;
  message: string;
}

interface ImpersonateTenantResponse {
  token: string;
  tenantId: string;
  expiresAt: string;
}

type LicenseStatus = "active" | "expiring" | "expired" | "unknown";

interface EnhancedTenant extends HqTenantUsageDto {
  daysRemaining: number | null;
  status: LicenseStatus;
}

const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "Tüm İşlemler" },
  { value: "license_create", label: "Lisans Oluşturma" },
  { value: "license_import", label: "CSV İçe Aktarma" },
  { value: "license_export", label: "CSV Dışa Aktarma" },
  { value: "tenant_impersonate", label: "Kursu Gör (Impersonation)" },
];

const KpiCard = ({
  title,
  value,
  colorClass,
  onClick,
}: {
  title: string;
  value: number;
  colorClass: string;
  onClick?: () => void;
}) => (
  <div
    className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${onClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
    onClick={onClick}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    <p className={`mt-2 text-3xl font-semibold ${colorClass}`}>{value}</p>
  </div>
);

const CSV_TEMPLATE = `KursAdi,Sehir,KullaniciAdi,Sifre,IletisimEposta,IletisimTelefon,LisansBitisTarihi
Deneme Kursu,Ankara,deneme.kurs,GucluSifre123!,info@deneme.com,+905551112233,2026-12-31`;

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiErrorResponse;
    const message = apiError.response?.data?.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
};

export default function HqDashboardPage() {
  const [data, setData] = useState<HqTenantUsageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<LicenseImportResult | null>(null);
  const [summary, setSummary] = useState<HqLicenseSummaryDto | null>(null);
  const [logs, setLogs] = useState<LicenseReminderLogDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);
  const [csvLogs, setCsvLogs] = useState<LicenseCsvLogDto[]>([]);
  const [csvSummary, setCsvSummary] = useState<CsvSummaryDto | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [csvLogsLoading, setCsvLogsLoading] = useState(false);
  const [csvLogsError, setCsvLogsError] = useState<string | null>(null);
  const [logFilters, setLogFilters] = useState({ tenantId: "all", status: "all", channel: "all" });
  const [auditFilters, setAuditFilters] = useState({ tenantId: "all", action: "all" });
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LicenseStatus>("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: "name" | "remaining" | "students"; direction: "asc" | "desc" }>({
    key: "name",
    direction: "asc",
  });
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [licenseForm, setLicenseForm] = useState({
    name: "",
    city: "",
    username: "",
    password: "",
    licenseYears: 1,
    contactEmail: "",
    contactPhone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [tokenModalTenant, setTokenModalTenant] = useState<{ id: string; name: string } | null>(null);
  const [tenantTokens, setTenantTokens] = useState<TenantApiTokenDto[]>([]);
  const [tokenModalLoading, setTokenModalLoading] = useState(false);
  const [tokenModalError, setTokenModalError] = useState<string | null>(null);
  const [newTokenForm, setNewTokenForm] = useState({
    name: "",
    description: "",
    expiresInDays: 90,
    permissions: "",
  });
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenActionLoading, setTokenActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<HqTenantUsageDto[]>("/hq/tenants/usage");
      setData(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Veriler yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const response = await api.get<HqLicenseSummaryDto>("/hq/tenants/summary");
      setSummary(response.data);
    } catch (err) {
      console.error("Summary load error", err);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const params = new URLSearchParams();
      if (logFilters.tenantId !== "all") params.append("tenantId", logFilters.tenantId);
      if (logFilters.status !== "all") params.append("status", logFilters.status);
      if (logFilters.channel !== "all") params.append("channel", logFilters.channel);
      params.append("take", "200");
      const response = await api.get<LicenseReminderLogDto[]>(`/hq/license-reminders?${params.toString()}`);
      setLogs(response.data);
    } catch (err) {
      setLogsError(getApiErrorMessage(err, "Hatırlatma kayıtları yüklenemedi."));
    } finally {
      setLogsLoading(false);
    }
  }, [logFilters]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = new URLSearchParams();
      if (auditFilters.tenantId !== "all") params.append("tenantId", auditFilters.tenantId);
      if (auditFilters.action !== "all") params.append("action", auditFilters.action);
      params.append("take", "200");
      const response = await api.get<AuditLogDto[]>(`/hq/audit?${params.toString()}`);
      setAuditLogs(response.data);
    } catch (err) {
      setAuditError(getApiErrorMessage(err, "İşlem geçmişi yüklenemedi."));
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  const loadCsvLogs = useCallback(async () => {
    setCsvLogsLoading(true);
    setCsvLogsError(null);
    try {
      const [logsResponse, summaryResponse] = await Promise.all([
        api.get<LicenseCsvLogDto[]>("/hq/audit/csv-logs?take=100"),
        api.get<CsvSummaryDto>("/hq/audit/csv-summary"),
      ]);
      setCsvLogs(logsResponse.data);
      setCsvSummary(summaryResponse.data);
    } catch (err) {
      setCsvLogsError(getApiErrorMessage(err, "CSV işlemleri yüklenemedi."));
    } finally {
      setCsvLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSummary();
  }, [loadData, loadSummary]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  useEffect(() => {
    setSelectedTenants([]);
  }, [data]);

  useEffect(() => {
    loadCsvLogs();
  }, [loadCsvLogs]);

  const [permissions, setPermissions] = useState({
    canCreate: true,
    canExport: true,
    canImport: true,
    canImpersonate: true,
    canManage: true,
  });
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const userRaw = localStorage.getItem("user");
    if (!userRaw) return;
    try {
      const parsed = JSON.parse(userRaw);
      const role = parsed?.role ?? "PlatformOwner";
      const permsMap: Record<string, Partial<typeof permissions>> = {
        PlatformOwner: { canCreate: true, canExport: true, canImport: true, canImpersonate: true, canManage: true },
        HQSupport: { canCreate: true, canExport: false, canImport: false, canImpersonate: true, canManage: false },
        HQSales: { canCreate: true, canExport: true, canImport: false, canImpersonate: false, canManage: false },
      };
      setPermissions({
        canCreate: permsMap[role]?.canCreate ?? true,
        canExport: permsMap[role]?.canExport ?? true,
        canImport: permsMap[role]?.canImport ?? true,
        canImpersonate: permsMap[role]?.canImpersonate ?? true,
        canManage: permsMap[role]?.canManage ?? true,
      });
    } catch {
      // ignore
    }
  }, [mounted]);

  const handleCreateLicense = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      // ExpireDate hesapla
      const expireDate = new Date();
      expireDate.setFullYear(expireDate.getFullYear() + licenseForm.licenseYears);

      const payload = {
        name: licenseForm.name,
        city: licenseForm.city || undefined,
        username: licenseForm.username,
        password: licenseForm.password,
        expireDate: expireDate.toISOString().split("T")[0],
        contactEmail: licenseForm.contactEmail,
        contactPhone: licenseForm.contactPhone || undefined,
      };

      await api.post("/hq/tenants", payload);
      setShowLicenseModal(false);
      setLicenseForm({
        name: "",
        city: "",
        username: "",
        password: "",
        licenseYears: 1,
        contactEmail: "",
        contactPhone: "",
      });
      setNotification({ type: "success", message: "Lisans başarıyla oluşturuldu." });
      await loadData();
      await loadSummary();
      await loadAuditLogs();
    } catch (err) {
      const message = getApiErrorMessage(err, "Lisans oluşturulurken bir hata oluştu.");
      setFormError(message);
      setNotification({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  const loadTenantTokens = useCallback(
    async (tenantId: string) => {
      setTokenModalLoading(true);
      setTokenModalError(null);
      setGeneratedToken(null);
      try {
        const response = await api.get<TenantApiTokenDto[]>(`/hq/tenants/${tenantId}/tokens`);
        setTenantTokens(response.data);
      } catch (err) {
        setTokenModalError(getApiErrorMessage(err, "API tokenları yüklenemedi."));
      } finally {
        setTokenModalLoading(false);
      }
    },
    []
  );

  const openTokenModal = (tenantId: string, tenantName: string) => {
    setTokenModalTenant({ id: tenantId, name: tenantName });
    loadTenantTokens(tenantId);
  };

  const closeTokenModal = () => {
    setTokenModalTenant(null);
    setTenantTokens([]);
    setGeneratedToken(null);
    setNewTokenForm({
      name: "",
      description: "",
      expiresInDays: 90,
      permissions: "",
    });
  };

  const handleCreateApiToken = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenModalTenant) return;
    if (!newTokenForm.name.trim()) {
      setTokenModalError("Token adı zorunludur.");
      return;
    }

    setTokenActionLoading(true);
    setTokenModalError(null);

    try {
      const payload = {
        name: newTokenForm.name.trim(),
        description: newTokenForm.description?.trim() || undefined,
        expiresInDays: newTokenForm.expiresInDays || undefined,
        permissions: newTokenForm.permissions
          ? newTokenForm.permissions
              .split(",")
              .map((p) => p.trim())
              .filter((p) => p.length > 0)
          : [],
      };

      const response = await api.post<CreateTenantApiTokenResponse>(
        `/hq/tenants/${tokenModalTenant.id}/tokens`,
        payload
      );

      setGeneratedToken(response.data.plainToken);
      setTenantTokens((prev) => [response.data.token, ...prev]);
      setNewTokenForm({
        name: "",
        description: "",
        expiresInDays: 90,
        permissions: "",
      });
      setNotification({ type: "success", message: "API token üretildi." });
    } catch (err) {
      setTokenModalError(getApiErrorMessage(err, "Token oluşturulamadı."));
    } finally {
      setTokenActionLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    if (!tokenModalTenant) return;
    setTokenActionLoading(true);
    setTokenModalError(null);
    try {
      await api.post(`/hq/tenants/${tokenModalTenant.id}/tokens/${tokenId}/revoke`, {});
      setTenantTokens((prev) => prev.map((token) => (token.id === tokenId ? { ...token, isRevoked: true, revokedAt: new Date().toISOString() } : token)));
      setNotification({ type: "success", message: "Token iptal edildi." });
    } catch (err) {
      setTokenModalError(getApiErrorMessage(err, "Token iptal edilemedi."));
    } finally {
      setTokenActionLoading(false);
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setNotification({ type: "success", message: "Token kopyalandı." });
    } catch {
      setNotification({ type: "error", message: "Token kopyalanamadı." });
    }
  };

  const getDaysRemaining = (expireDate?: string) => {
    if (!expireDate) return null;
    const exp = new Date(expireDate);
    const now = new Date();
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const enhancedTenants: EnhancedTenant[] = useMemo(() => {
    return data.map((tenant) => {
      const daysRemaining = getDaysRemaining(tenant.expireDate);
      let status: LicenseStatus = "unknown";

      if (daysRemaining !== null) {
        if (daysRemaining < 0) status = "expired";
        else if (daysRemaining <= 30) status = "expiring";
        else status = "active";
      }

      return { ...tenant, daysRemaining, status };
    });
  }, [data]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    enhancedTenants.forEach((tenant) => {
      if (tenant.city) cities.add(tenant.city);
    });
    return Array.from(cities).sort();
  }, [enhancedTenants]);

  const tenantOptions = useMemo(() => {
    return enhancedTenants.map((tenant) => ({ id: tenant.tenantId, name: tenant.tenantName }));
  }, [enhancedTenants]);

  const filteredTenants = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = enhancedTenants.filter((tenant) => {
      const matchesSearch =
        tenant.tenantName.toLowerCase().includes(term) ||
        (tenant.username ?? "").toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" ? true : tenant.status === statusFilter;
      const matchesCity = cityFilter === "all" ? true : tenant.city?.toLowerCase() === cityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCity;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortConfig.key === "name") {
        const compare = a.tenantName.localeCompare(b.tenantName, "tr-TR");
        return sortConfig.direction === "asc" ? compare : -compare;
      }

      if (sortConfig.key === "students") {
        const compare = a.totalStudents - b.totalStudents;
        return sortConfig.direction === "asc" ? compare : -compare;
      }

      const remainingA = a.daysRemaining ?? Number.MAX_SAFE_INTEGER;
      const remainingB = b.daysRemaining ?? Number.MAX_SAFE_INTEGER;
      const compare = remainingA - remainingB;
      return sortConfig.direction === "asc" ? compare : -compare;
    });

    return sorted;
  }, [enhancedTenants, searchTerm, statusFilter, cityFilter, sortConfig]);

  const handleSort = (key: "name" | "remaining" | "students") => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const renderStatusBadge = (tenant: EnhancedTenant) => {
    if (tenant.status === "expired") {
      return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Süresi Dolmuş</span>;
    }
    if (tenant.status === "expiring") {
      return (
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
          {tenant.daysRemaining} gün kaldı
        </span>
      );
    }
    if (tenant.status === "active") {
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Aktif</span>
      );
    }
    return (
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">Tarih girilmemiş</span>
    );
  };

  const handleExportCsv = async () => {
    try {
      const response = await api.get("/hq/tenants/export", { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `lisanslar-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setNotification({ type: "success", message: "CSV dosyası indirildi." });
      await loadAuditLogs();
      await loadCsvLogs();
    } catch (err) {
      setNotification({ type: "error", message: getApiErrorMessage(err, "CSV indirilemedi.") });
    }
  };

  const toggleSelectTenant = (tenantId: string) => {
    setSelectedTenants((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]
    );
  };

  const toggleSelectAll = () => {
    if (filteredTenants.length === 0) return;
    const allIds = filteredTenants.map((t) => t.tenantId);
    const allSelected = allIds.every((id) => selectedTenants.includes(id));
    setSelectedTenants(allSelected ? [] : allIds);
  };

  const handleBulkAction = async (action: "disable" | "enable" | "delete") => {
    if (selectedTenants.length === 0) return;
    if (
      action === "delete" &&
      !window.confirm("Seçili lisansları silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")
    ) {
      return;
    }

    try {
      await api.post("/hq/tenants/bulk-status", { action, tenantIds: selectedTenants });
      setNotification({
        type: "success",
        message:
          action === "disable"
            ? "Lisanslar pasif hale getirildi."
            : action === "enable"
            ? "Lisanslar aktifleştirildi."
            : "Uygun lisanslar silindi.",
      });
      setSelectedTenants([]);
      await loadData();
      await loadSummary();
      await loadAuditLogs();
    } catch (err) {
      setNotification({ type: "error", message: getApiErrorMessage(err, "İşlem tamamlanamadı.") });
    }
  };

  const handleImportFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setImportResult(null);
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
    } else {
      setImportFile(null);
    }
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportResult({
        totalRows: 0,
        imported: 0,
        failed: 0,
        errors: [{ rowNumber: 0, message: "Lütfen bir CSV dosyası seçin." }],
      });
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const response = await api.post<LicenseImportResult>("/hq/tenants/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(response.data);
      setNotification({ type: "success", message: "CSV içe aktarma tamamlandı." });
      await loadData();
      await loadSummary();
      await loadAuditLogs();
      await loadCsvLogs();
      setImportFile(null);
    } catch (err) {
      const message = getApiErrorMessage(err, "İçe aktarma başarısız.");
      setImportResult({
        totalRows: 0,
        imported: 0,
        failed: 0,
        errors: [{ rowNumber: 0, message }],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImpersonate = async (tenantId: string) => {
    try {
      const response = await api.post<ImpersonateTenantResponse>(`/hq/tenants/${tenantId}/impersonate`);
      const targetUrl = `/impersonate?token=${encodeURIComponent(response.data.token)}&tenantId=${encodeURIComponent(
        response.data.tenantId
      )}`;
      window.open(targetUrl, "_blank", "noopener");
      setNotification({ type: "success", message: "Yeni pencere hazırlandı. Lütfen bekleyin." });
      await loadAuditLogs();
    } catch (err) {
      setNotification({ type: "error", message: getApiErrorMessage(err, "Kursa geçiş yapılamadı.") });
    }
  };

  const LogStatusBadge = ({ log }: { log: LicenseReminderLogDto }) => {
    if (log.status === "sent") {
      return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Gönderildi</span>;
    }
    if (log.status === "failed") {
      return (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700" title={log.error ?? undefined}>
          Hata
        </span>
      );
    }
    if (log.status === "skipped") {
      return (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700" title={log.error ?? undefined}>
          Atlandı
        </span>
      );
    }
    return <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">Bekliyor</span>;
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    if (!mounted) return "-"; // Server-side rendering için placeholder
    try {
      return new Date(value).toLocaleString("tr-TR");
    } catch {
      return value;
    }
  };

  const formatDateOnly = (value?: string) => {
    if (!value) return "-";
    if (!mounted) return "-"; // Server-side rendering için placeholder
    try {
      return new Date(value).toLocaleDateString("tr-TR");
    } catch {
      return value;
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lisans-sablon.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              HQ — Lisans Yönetimi
            </h1>
            <p className="text-sm text-slate-600 mt-1">SRC kurslarına verilen lisansları görüntüleyin ve yönetin.</p>
          </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={loadData}
            className="rounded-lg bg-gradient-to-r from-slate-500 to-slate-600 px-4 py-2 text-sm font-medium text-white hover:from-slate-600 hover:to-slate-700 shadow-md transition-all"
            disabled={loading}
          >
            {loading ? "Yükleniyor..." : "Yenile"}
          </button>
          {permissions.canExport && (
            <button
              onClick={handleExportCsv}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-600 shadow-md transition-all"
            >
              CSV İndir
            </button>
          )}
          {permissions.canImport && (
            <button
              onClick={() => setShowImportModal(true)}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-purple-600 shadow-md transition-all"
            >
              CSV İçe Aktar
            </button>
          )}
          {permissions.canCreate && (
            <button
              onClick={() => setShowLicenseModal(true)}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-medium text-white hover:from-emerald-600 hover:to-green-600 shadow-lg transition-all transform hover:scale-105"
            >
              + Yeni Lisans Ekle
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => {}}>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide mb-2">Toplam Lisans</p>
            <p className="text-white text-4xl font-bold">{summary.totalLicenses}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => setStatusFilter("expiring")}>
            <p className="text-yellow-100 text-xs font-semibold uppercase tracking-wide mb-2">Yakında Dolacak</p>
            <p className="text-white text-4xl font-bold">{summary.expiringSoon}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => setStatusFilter("expired")}>
            <p className="text-red-100 text-xs font-semibold uppercase tracking-wide mb-2">Süresi Dolmuş</p>
            <p className="text-white text-4xl font-bold">{summary.expired}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => {}}>
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wide mb-2">Bu Ay Açılan</p>
            <p className="text-white text-4xl font-bold">{summary.createdThisMonth}</p>
          </div>
        </div>
      )}

      {permissions.canManage && (
        <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-orange-800">
              Seçili lisanslar: <strong className="text-2xl text-orange-600">{selectedTenants.length}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleBulkAction("disable")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-yellow-600 hover:to-orange-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pasifleştir
              </button>
              <button
                onClick={() => handleBulkAction("enable")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-medium text-white hover:from-emerald-600 hover:to-green-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aktifleştir
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2 text-sm font-medium text-white hover:from-red-600 hover:to-rose-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lisans Listesi - En Üste Taşındı */}
      <div className="grid gap-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 p-6 shadow-lg md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">🔍 Ara</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Kurs veya kullanıcı adı..."
            className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">📊 Durum</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | LicenseStatus)}
            className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Tümü</option>
            <option value="active">Aktif</option>
            <option value="expiring">Yakında Dolacak</option>
            <option value="expired">Süresi Dolmuş</option>
            <option value="unknown">Tarih Girilmemiş</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">🏙️ Şehir</label>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Tümü</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-6 text-center text-sm text-indigo-600">
          Veriler yükleniyor...
        </div>
      ) : error ? (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border-2 border-indigo-200 bg-white shadow-lg">
          <table className="min-w-full divide-y divide-indigo-100 text-sm">
            <thead className="bg-gradient-to-r from-indigo-100 to-purple-100">
              <tr>
                {permissions.canManage && (
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-indigo-800">
                    <input
                      type="checkbox"
                      checked={
                        filteredTenants.length > 0 &&
                        filteredTenants.every((t) => selectedTenants.includes(t.tenantId))
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th
                  className="cursor-pointer px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800 hover:text-indigo-900"
                  onClick={() => handleSort("name")}
                >
                  Kurs Adı
                </th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">Kullanıcı Adı</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">Şehir</th>
                <th className="px-4 py-3 text-right font-bold uppercase tracking-wide text-xs text-indigo-800">
                  Toplam Öğrenci
                </th>
                <th className="px-4 py-3 text-right font-bold uppercase tracking-wide text-xs text-indigo-800">
                  Aktif Öğrenci
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800 hover:text-indigo-900"
                  onClick={() => handleSort("remaining")}
                >
                  Son Kullanma
                </th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">Durum</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50 bg-white">
              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan={permissions.canManage ? 8 : 7} className="px-4 py-8 text-center text-sm text-indigo-600">
                    Kriterlere uygun lisans bulunamadı.
                  </td>
                </tr>
              )}
              {filteredTenants.map((tenant) => (
                <tr key={tenant.tenantId} className="hover:bg-indigo-50/50 transition-colors">
                  {permissions.canManage && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTenants.includes(tenant.tenantId)}
                        onChange={() => toggleSelectTenant(tenant.tenantId)}
                        className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold text-slate-800">{tenant.tenantName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 bg-indigo-50 rounded px-2 py-1">{tenant.username || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{tenant.city || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{tenant.totalStudents}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{tenant.activeStudents}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {tenant.expireDate ? formatDateOnly(tenant.expireDate) : "-"}
                  </td>
                  <td className="px-4 py-3">{renderStatusBadge(tenant)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.canImpersonate && (
                        <button
                          onClick={() => handleImpersonate(tenant.tenantId)}
                          className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-1 text-xs font-medium text-white hover:from-indigo-600 hover:to-purple-600 shadow-md transition-all"
                        >
                          Kursu Gör
                        </button>
                      )}
                      {permissions.canManage && (
                        <button
                          onClick={() => openTokenModal(tenant.tenantId, tenant.tenantName)}
                          className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-medium text-white hover:from-purple-600 hover:to-pink-600 shadow-md transition-all"
                        >
                          API Tokenları
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CSV İşlem Kayıtları */}
      <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-lg p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              CSV İşlem Kayıtları
            </h2>
            <p className="text-sm text-emerald-600 mt-1">Son içe/dışa aktarma işlemlerinin özeti.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadCsvLogs}
              className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-3 py-2 text-sm font-medium text-white hover:from-emerald-700 hover:to-green-700 shadow-md transition-all"
              disabled={csvLogsLoading}
            >
              {csvLogsLoading ? "Yükleniyor..." : "Yenile"}
            </button>
            <button
              onClick={async () => {
                try {
                  const response = await api.get("/hq/audit/csv-logs?format=csv", { responseType: "blob" });
                  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement("a");
                  link.href = blobUrl;
                  link.download = `csv-logs-${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(blobUrl);
                } catch (err) {
                  setNotification({ type: "error", message: getApiErrorMessage(err, "CSV log indirilemedi.") });
                }
              }}
              className="rounded-lg bg-gradient-to-r from-green-600 to-teal-600 px-3 py-2 text-sm font-medium text-white hover:from-green-700 hover:to-teal-700 shadow-md transition-all"
            >
              CSV Olarak İndir
            </button>
          </div>
        </div>

        {csvLogsError ? (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-700">{csvLogsError}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6 shadow-md">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-4">Son 7 Gün - CSV Özet</p>
              <div className="mt-3 flex items-end gap-3">
                <div className="flex-1 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-center shadow-lg">
                  <p className="text-xs text-emerald-100 font-medium mb-1">Toplam İçe Aktarma</p>
                  <p className="text-3xl font-bold text-white">{csvSummary?.totalImports ?? 0}</p>
                </div>
                <div className="flex-1 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-center shadow-lg">
                  <p className="text-xs text-blue-100 font-medium mb-1">Toplam Dışa Aktarma</p>
                  <p className="text-3xl font-bold text-white">{csvSummary?.totalExports ?? 0}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {csvSummary &&
                  Object.entries(csvSummary.last7Days).map(([date, point]) => (
                    <div key={date} className="text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>
                          {mounted
                            ? (() => {
                                try {
                                  return new Date(date).toLocaleDateString("tr-TR", { weekday: "short", month: "short", day: "numeric" });
                                } catch {
                                  return date;
                                }
                              })()
                            : date.split("-").reverse().join(".")}
                        </span>
                        <span className="text-emerald-600">+{point.imports}</span>
                        <span className="text-blue-600">+{point.exports}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        <div className="h-2 rounded bg-slate-200">
                          <div
                            className="h-2 rounded bg-emerald-500"
                            style={{ width: `${Math.min(point.imports * 10, 100)}%` }}
                          />
                        </div>
                        <div className="h-2 rounded bg-slate-200">
                          <div
                            className="h-2 rounded bg-blue-500"
                            style={{ width: `${Math.min(point.exports * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="rounded-xl border-2 border-emerald-200 bg-white/80 backdrop-blur-sm p-4">
              {csvLogs.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center text-sm text-emerald-600">
                  Henüz CSV işlemi kaydı yok.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg">
                  <table className="min-w-full divide-y divide-emerald-100 text-sm">
                    <thead className="bg-gradient-to-r from-emerald-100 to-green-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-emerald-800">İşlem</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-emerald-800">Kullanıcı</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-emerald-800">Tarih</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-emerald-800">Toplam Satır</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-emerald-800">Başarılı</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-emerald-800">Başarısız</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50 bg-white">
                      {csvLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-emerald-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                          <td className="px-4 py-3 text-slate-600">{log.actorName}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(log.createdAt)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">{log.totalRows ?? "-"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">{log.imported ?? "-"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">{log.failed ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hatırlatma Geçmişi */}
      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50/30 shadow-lg p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-purple-800 flex items-center gap-2">
                <span className="text-2xl">🔔</span>
                Hatırlatma Geçmişi
              </h2>
              <p className="text-sm text-purple-600 mt-1">E-posta ve SMS ile gönderilen lisans hatırlatmalarını görüntüleyin.</p>
            </div>
            <div className="flex items-center gap-3 bg-white/80 rounded-lg px-4 py-2 border border-purple-200">
              <span className={`text-sm font-medium ${reminderEnabled ? "text-emerald-700" : "text-slate-500"}`}>
                {reminderEnabled ? "Aktif" : "Pasif"}
              </span>
              <button
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  reminderEnabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    reminderEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <select
              value={logFilters.tenantId}
              onChange={(e) => setLogFilters({ ...logFilters, tenantId: e.target.value })}
              className="rounded-lg border-2 border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            >
              <option value="all">Tüm Lisanslar</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            <select
              value={logFilters.status}
              onChange={(e) => setLogFilters({ ...logFilters, status: e.target.value })}
              className="rounded-lg border-2 border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            >
              <option value="all">Durum: Tümü</option>
              <option value="sent">Gönderildi</option>
              <option value="failed">Hata</option>
              <option value="skipped">Atlandı</option>
            </select>
            <select
              value={logFilters.channel}
              onChange={(e) => setLogFilters({ ...logFilters, channel: e.target.value })}
              className="rounded-lg border-2 border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            >
              <option value="all">Kanal: Tümü</option>
              <option value="email">E-posta</option>
              <option value="sms">SMS</option>
              <option value="both">E-posta + SMS</option>
            </select>
            <button
              onClick={loadLogs}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-indigo-700 shadow-md transition-all"
              disabled={logsLoading}
            >
              {logsLoading ? "Yükleniyor..." : "Kayıtları Yenile"}
            </button>
          </div>
        </div>

        {logsError ? (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-700">{logsError}</div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-purple-200 bg-white/50 p-6 text-center text-sm text-purple-600">
            Henüz hatırlatma kaydı yok.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white/80 backdrop-blur-sm">
            <table className="min-w-full divide-y divide-purple-100 text-sm">
              <thead className="bg-gradient-to-r from-purple-100 to-indigo-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-purple-800">
                    Kurs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-purple-800">
                    Kanal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-purple-800">
                    Alıcı
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-purple-800">
                    Eşik
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-purple-800">
                    Gönderim
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-purple-800">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-purple-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{log.tenantName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800">
                        {log.channel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.recipient || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-purple-700">{log.thresholdDays} gün</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="text-xs text-slate-500">Oluşturma: {formatDateTime(log.createdAt)}</div>
                      {log.sentAt && <div className="text-xs text-emerald-600 font-medium">Gönderildi: {formatDateTime(log.sentAt)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <LogStatusBadge log={log} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* İşlem Geçmişi */}
      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/30 shadow-lg p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              İşlem Geçmişi
            </h2>
            <p className="text-sm text-blue-600 mt-1">CSV işlemleri ve kursa geçiş gibi kritik aksiyonların kaydı.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <select
              value={auditFilters.tenantId}
              onChange={(e) => setAuditFilters({ ...auditFilters, tenantId: e.target.value })}
              className="rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">Tüm Lisanslar</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            <select
              value={auditFilters.action}
              onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
              className="rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {AUDIT_ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={loadAuditLogs}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all"
              disabled={auditLoading}
            >
              {auditLoading ? "Yükleniyor..." : "Kaydı Yenile"}
            </button>
          </div>
        </div>

        {auditError ? (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-sm text-red-700">{auditError}</div>
        ) : auditLogs.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-blue-200 bg-white/50 p-6 text-center text-sm text-blue-600">
            Henüz işlem kaydı bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white/80 backdrop-blur-sm">
            <table className="min-w-full divide-y divide-blue-100 text-sm">
              <thead className="bg-gradient-to-r from-blue-100 to-indigo-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-blue-800">
                    İşlem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-blue-800">
                    Kullanıcı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-blue-800">
                    Lisans
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-blue-800">
                    Tarih
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 bg-white">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{AUDIT_ACTION_OPTIONS.find((o) => o.value === log.action)?.label ?? log.action}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.actorName}
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-medium">{log.actorRole}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.tenantId || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notification && (
        <div
          className={`fixed bottom-4 right-4 rounded-xl border-2 px-6 py-4 text-sm shadow-xl z-50 animate-slide-up ${
            notification.type === "success"
              ? "border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800"
              : "border-red-300 bg-gradient-to-r from-red-50 to-rose-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{notification.type === "success" ? "✅" : "❌"}</span>
            {notification.message}
          </div>
        </div>
      )}

      {permissions.canManage && (
        <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-orange-800">
              Seçili lisanslar: <strong className="text-2xl text-orange-600">{selectedTenants.length}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleBulkAction("disable")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-yellow-600 hover:to-orange-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pasifleştir
              </button>
              <button
                onClick={() => handleBulkAction("enable")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-medium text-white hover:from-emerald-600 hover:to-green-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aktifleştir
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2 text-sm font-medium text-white hover:from-red-600 hover:to-rose-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => {}}>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide mb-2">Toplam Lisans</p>
            <p className="text-white text-4xl font-bold">{summary.totalLicenses}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => setStatusFilter("expiring")}>
            <p className="text-yellow-100 text-xs font-semibold uppercase tracking-wide mb-2">Yakında Dolacak</p>
            <p className="text-white text-4xl font-bold">{summary.expiringSoon}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => setStatusFilter("expired")}>
            <p className="text-red-100 text-xs font-semibold uppercase tracking-wide mb-2">Süresi Dolmuş</p>
            <p className="text-white text-4xl font-bold">{summary.expired}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105" onClick={() => {}}>
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wide mb-2">Bu Ay Açılan</p>
            <p className="text-white text-4xl font-bold">{summary.createdThisMonth}</p>
          </div>
        </div>
      )}

      {permissions.canManage && (
        <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-orange-800">
              Seçili lisanslar: <strong className="text-2xl text-orange-600">{selectedTenants.length}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleBulkAction("disable")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-yellow-600 hover:to-orange-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pasifleştir
              </button>
              <button
                onClick={() => handleBulkAction("enable")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-medium text-white hover:from-emerald-600 hover:to-green-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aktifleştir
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={selectedTenants.length === 0}
                className="rounded-lg bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2 text-sm font-medium text-white hover:from-red-600 hover:to-rose-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lisans Listesi - En Üste Taşındı */}
      <div className="grid gap-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 p-6 shadow-lg md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">🔍 Ara</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Kurs veya kullanıcı adı..."
            className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">📊 Durum</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | LicenseStatus)}
            className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Tümü</option>
            <option value="active">Aktif</option>
            <option value="expiring">Yakında Dolacak</option>
            <option value="expired">Süresi Dolmuş</option>
            <option value="unknown">Tarih Girilmemiş</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">🏙️ Şehir</label>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">Tümü</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/50 p-6 text-center text-sm text-indigo-600">
          Veriler yükleniyor...
        </div>
      ) : error ? (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border-2 border-indigo-200 bg-white shadow-lg">
          <table className="min-w-full divide-y divide-indigo-100 text-sm">
            <thead className="bg-gradient-to-r from-indigo-100 to-purple-100">
              <tr>
                {permissions.canManage && (
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-indigo-800">
                    <input
                      type="checkbox"
                      checked={
                        filteredTenants.length > 0 &&
                        filteredTenants.every((t) => selectedTenants.includes(t.tenantId))
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th
                  className="cursor-pointer px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800 hover:text-indigo-900"
                  onClick={() => handleSort("name")}
                >
                  Kurs Adı
                </th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">Kullanıcı Adı</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">Şehir</th>
                <th className="px-4 py-3 text-right font-bold uppercase tracking-wide text-xs text-indigo-800">
                  Toplam Öğrenci
                </th>
                <th className="px-4 py-3 text-right font-bold uppercase tracking-wide text-xs text-indigo-800">
                  Aktif Öğrenci
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800 hover:text-indigo-900"
                  onClick={() => handleSort("remaining")}
                >
                  Son Kullanma
                </th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">Durum</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide text-xs text-indigo-800">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50 bg-white">
              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan={permissions.canManage ? 8 : 7} className="px-4 py-8 text-center text-sm text-indigo-600">
                    Kriterlere uygun lisans bulunamadı.
                  </td>
                </tr>
              )}
              {filteredTenants.map((tenant) => (
                <tr key={tenant.tenantId} className="hover:bg-indigo-50/50 transition-colors">
                  {permissions.canManage && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTenants.includes(tenant.tenantId)}
                        onChange={() => toggleSelectTenant(tenant.tenantId)}
                        className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold text-slate-800">{tenant.tenantName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 bg-indigo-50 rounded px-2 py-1">{tenant.username || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{tenant.city || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{tenant.totalStudents}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{tenant.activeStudents}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {tenant.expireDate ? formatDateOnly(tenant.expireDate) : "-"}
                  </td>
                  <td className="px-4 py-3">{renderStatusBadge(tenant)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.canImpersonate && (
                        <button
                          onClick={() => handleImpersonate(tenant.tenantId)}
                          className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-1 text-xs font-medium text-white hover:from-indigo-600 hover:to-purple-600 shadow-md transition-all"
                        >
                          Kursu Gör
                        </button>
                      )}
                      {permissions.canManage && (
                        <button
                          onClick={() => openTokenModal(tenant.tenantId, tenant.tenantName)}
                          className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-medium text-white hover:from-purple-600 hover:to-pink-600 shadow-md transition-all"
                        >
                          API Tokenları
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lisans Ekleme Modal */}
      {showLicenseModal && permissions.canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Yeni Lisans Ekle</h2>
              <button
                onClick={() => setShowLicenseModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateLicense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Kurs Adı *</label>
                <input
                  type="text"
                  required
                  value={licenseForm.name}
                  onChange={(e) => setLicenseForm({ ...licenseForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Örn: Mavi-Beyaz Akademi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Şehir</label>
                <input
                  type="text"
                  value={licenseForm.city}
                  onChange={(e) => setLicenseForm({ ...licenseForm, city: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Örn: Ankara"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Kullanıcı Adı *</label>
                <input
                  type="text"
                  required
                  value={licenseForm.username}
                  onChange={(e) => setLicenseForm({ ...licenseForm, username: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  placeholder="Kurs için özel kullanıcı adı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Şifre *</label>
                <div className="mt-1 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={licenseForm.password}
                    onChange={(e) => setLicenseForm({ ...licenseForm, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 font-mono"
                    placeholder="Kurs için özel şifre"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.29 3.29L12 12m-3.29-3.29L12 12m0 0l3.29 3.29M12 12l3.29-3.29m0 0a9.97 9.97 0 012.12-2.12m-2.12 2.12L12 12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">İletişim E-postası *</label>
                <input
                  type="email"
                  required
                  value={licenseForm.contactEmail}
                  onChange={(e) => setLicenseForm({ ...licenseForm, contactEmail: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="hq@kurs.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">İletişim Telefonu</label>
                <input
                  type="tel"
                  value={licenseForm.contactPhone}
                  onChange={(e) => setLicenseForm({ ...licenseForm, contactPhone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="+90 5xx xxx xx xx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Lisans Süresi (Yıl) *</label>
                <select
                  required
                  value={licenseForm.licenseYears}
                  onChange={(e) =>
                    setLicenseForm({ ...licenseForm, licenseYears: parseInt(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value={1}>1 Yıl</option>
                  <option value={2}>2 Yıl</option>
                  <option value={3}>3 Yıl</option>
                  <option value={5}>5 Yıl</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLicenseModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : "Lisans Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV İçe Aktarma Modal */}
      {showImportModal && permissions.canImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">CSV İçe Aktarma</h2>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-semibold">Beklenen sütunlar:</p>
              <p className="mt-1">
                <code className="text-xs">
                  KursAdi, Sehir, KullaniciAdi, Sifre, IletisimEposta, IletisimTelefon, LisansBitisTarihi
                </code>
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="mt-3 inline-flex items-center rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Örnek CSV İndir
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">CSV Dosyası *</label>
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={handleImportFileChange}
                  className="mt-1 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {importing ? "İçe aktarılıyor..." : "İçe Aktar"}
                </button>
              </div>
            </form>

            {importResult && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>
                  <strong>Toplam Satır:</strong> {importResult.totalRows} • <strong>Başarılı:</strong>{" "}
                  {importResult.imported} • <strong>Başarısız:</strong> {importResult.failed}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-600">
                    {importResult.errors.slice(0, 5).map((error, idx) => (
                      <li key={`${error.rowNumber}-${idx}`}>Satır {error.rowNumber}: {error.message}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>... {importResult.errors.length - 5} hata daha</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tokenModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">API Tokenları</h2>
                <p className="text-sm text-slate-500">
                  {tokenModalTenant.name} ({tokenModalTenant.id})
                </p>
              </div>
              <button onClick={closeTokenModal} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {tokenModalError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {tokenModalError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Mevcut Tokenlar</h3>
                    <p className="text-sm text-slate-500">Aktif ve iptal edilmiş tokenları görüntüleyin.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {tenantTokens.length} kayıt
                  </span>
                </div>

                {tokenModalLoading ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Tokenlar yükleniyor...
                  </div>
                ) : tenantTokens.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Henüz token oluşturulmamış.
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                    {tenantTokens.map((token) => (
                      <div
                        key={token.id}
                        className="rounded-lg border border-slate-200 p-3 text-sm shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{token.name}</p>
                            <p className="text-xs text-slate-500">Önek: {token.tokenPrefix}...</p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              token.isRevoked
                                ? "bg-red-100 text-red-700"
                                : token.expiresAt && new Date(token.expiresAt) < new Date()
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {token.isRevoked
                              ? "İptal"
                              : token.expiresAt && new Date(token.expiresAt) < new Date()
                                ? "Süresi Doldu"
                                : "Aktif"}
                          </span>
                        </div>
                        {token.description && (
                          <p className="mt-2 text-xs text-slate-600">{token.description}</p>
                        )}
                        <div className="mt-2 grid gap-1 text-xs text-slate-500">
                          <div>Oluşturma: {formatDateTime(token.createdAt)}</div>
                          {token.expiresAt && <div>Bitiş: {formatDateTime(token.expiresAt)}</div>}
                          {token.lastUsedAt && <div>Son kullanım: {formatDateTime(token.lastUsedAt)}</div>}
                          {token.revokedAt && <div>İptal tarihi: {formatDateTime(token.revokedAt)}</div>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!token.isRevoked && (
                            <button
                              onClick={() => handleRevokeToken(token.id)}
                              disabled={tokenActionLoading}
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {tokenActionLoading ? "İşleniyor..." : "İptal Et"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
                <h3 className="text-lg font-semibold text-slate-800">Yeni Token Üret</h3>
                <p className="mb-4 text-sm text-slate-600">
                  Token sadece bir kez gösterilir. Güvenli yerde sakladığınızdan emin olun.
                </p>

                <form onSubmit={handleCreateApiToken} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Token Adı *</label>
                    <input
                      type="text"
                      required
                      value={newTokenForm.name}
                      onChange={(e) => setNewTokenForm({ ...newTokenForm, name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Örn: OBS Entegrasyonu"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Açıklama</label>
                    <textarea
                      value={newTokenForm.description}
                      onChange={(e) => setNewTokenForm({ ...newTokenForm, description: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Bu token hangi entegrasyon için kullanılacak?"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Geçerlilik (Gün)</label>
                      <input
                        type="number"
                        min={1}
                        value={newTokenForm.expiresInDays}
                        onChange={(e) =>
                          setNewTokenForm({ ...newTokenForm, expiresInDays: parseInt(e.target.value || "0") })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Örn: 90"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">İzinler (virgülle)</label>
                      <input
                        type="text"
                        value={newTokenForm.permissions}
                        onChange={(e) => setNewTokenForm({ ...newTokenForm, permissions: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Örn: students.read,payments.write"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeTokenModal}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                    >
                      Kapat
                    </button>
                    <button
                      type="submit"
                      disabled={tokenActionLoading}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {tokenActionLoading ? "Oluşturuluyor..." : "Token Oluştur"}
                    </button>
                  </div>
                </form>

                {generatedToken && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-emerald-700">Yeni Token</p>
                    <p className="mt-2 break-all rounded bg-slate-900/90 px-3 py-2 font-mono text-xs text-emerald-100">
                      {generatedToken}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Bu token sadece bir kez gösterilir.</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleCopyToken(generatedToken)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Kopyala
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
