"use client";

import { useEffect, useState, FormEvent } from "react";
import api from "@/lib/api";

interface TenantSummary {
  id: string;
  name: string;
}

interface AccountTransaction {
  id: number;
  tenantId: string;
  transactionDate: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  reference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

interface TransactionsResponse {
  transactions: AccountTransaction[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
  };
}

export default function HqAccountsPage() {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [filters, setFilters] = useState({
    tenantId: "",
    type: "",
    category: "",
    startDate: "",
    endDate: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: "",
    transactionDate: new Date().toISOString().split("T")[0],
    type: "income" as "income" | "expense",
    category: "",
    description: "",
    amount: 0,
    reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const categories = {
    income: ["license_payment", "course_fee", "other_income"],
    expense: ["rent", "salary", "utility", "supplies", "other_expense"],
  };

  useEffect(() => {
    loadTenants();
    loadTransactions();
  }, [filters]);

  const loadTenants = async () => {
    try {
      const response = await api.get<TenantSummary[]>("/tenants/my");
      setTenants(response.data);
      if (response.data.length > 0 && !formData.tenantId) {
        setFormData((prev) => ({ ...prev, tenantId: response.data[0].id }));
      }
    } catch (err) {
      console.error("Tenant load error:", err);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: 1, pageSize: 50 };
      if (filters.tenantId) params.tenantId = filters.tenantId;
      if (filters.type) params.type = filters.type;
      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get<TransactionsResponse>("/hq/accounts", { params });
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "İşlemler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      await api.post("/hq/accounts", formData);
      setShowModal(false);
      setFormData({
        tenantId: tenants[0]?.id || "",
        transactionDate: new Date().toISOString().split("T")[0],
        type: "income",
        category: "",
        description: "",
        amount: 0,
        reference: "",
        notes: "",
      });
      loadTransactions();
    } catch (err: any) {
      setFormError(err.response?.data?.message || "İşlem kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">HQ — Cari Hesap</h1>
          <p className="text-sm text-slate-500">Gelir ve gider işlemlerini takip edin.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Yeni İşlem
        </button>
      </div>

      {/* Özet Kartlar */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-medium text-emerald-700">Toplam Gelir</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900">
              {data.summary.totalIncome.toLocaleString("tr-TR", {
                style: "currency",
                currency: "TRY",
              })}
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-medium text-red-700">Toplam Gider</div>
            <div className="mt-1 text-2xl font-bold text-red-900">
              {data.summary.totalExpense.toLocaleString("tr-TR", {
                style: "currency",
                currency: "TRY",
              })}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-700">Bakiye</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {data.summary.balance.toLocaleString("tr-TR", {
                style: "currency",
                currency: "TRY",
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Şube</label>
            <select
              value={filters.tenantId}
              onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Tümü</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Tip</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">Tümü</option>
              <option value="income">Gelir</option>
              <option value="expense">Gider</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Kategori</label>
            <input
              type="text"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              placeholder="Kategori..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Başlangıç</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Bitiş</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>

      {/* İşlemler Tablosu */}
      {loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Yükleniyor...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tarih
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Şube
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tip
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kategori
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Açıklama
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tutar
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Referans
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/75">
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(t.transactionDate).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {tenants.find((tn) => tn.id === t.tenantId)?.name || t.tenantId}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        t.type === "income"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {t.type === "income" ? "Gelir" : "Gider"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.category}</td>
                  <td className="px-3 py-2 text-slate-600">{t.description}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      t.type === "income" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {t.amount.toLocaleString("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                    })}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.reference || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Yeni İşlem Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Yeni İşlem</h2>
              <button
                onClick={() => setShowModal(false)}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Şube</label>
                <select
                  required
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Seçiniz...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tarih</label>
                  <input
                    type="date"
                    required
                    value={formData.transactionDate}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tip</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as "income" | "expense", category: "" })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="income">Gelir</option>
                    <option value="expense">Gider</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Kategori</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Seçiniz...</option>
                  {categories[formData.type].map((cat) => {
                    const labels: Record<string, string> = {
                      license_payment: "Lisans Ödemesi",
                      course_fee: "Kurs Ücreti",
                      other_income: "Diğer Gelir",
                      rent: "Kira",
                      salary: "Maaş",
                      utility: "Fatura",
                      supplies: "Malzeme",
                      other_expense: "Diğer Gider",
                    };
                    return (
                      <option key={cat} value={cat}>
                        {labels[cat] || cat.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Açıklama</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tutar</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Referans</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Fatura no, işlem no..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Notlar</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

