"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface TenantSummary {
  id: string;
  name: string;
  city?: string | null;
  isActive: boolean;
}

export default function HqTenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<TenantSummary[]>("/tenants/my")
      .then((response) => {
        if (active) setTenants(response.data);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message ?? "Tenant listesi alınamadı.");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">HQ — Şubeler</h1>
        <p className="text-sm text-slate-500">
          Yetkili olduğunuz tüm şubeleri görüntüleyin ve durumlarını takip edin.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Veriler yükleniyor...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <li
              key={tenant.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{tenant.name}</h2>
                  <p className="text-sm text-slate-500">
                    {tenant.city ?? "Şehir bilgisi bulunmuyor"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    tenant.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tenant.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-400 break-all">{tenant.id}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


