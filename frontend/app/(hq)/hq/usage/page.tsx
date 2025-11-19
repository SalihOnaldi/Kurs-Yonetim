"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface HqTenantUsageDto {
  tenantId: string;
  tenantName: string;
  totalStudents: number;
  activeStudents: number;
  lastStudentCreatedAt?: string;
}

export default function HqUsagePage() {
  const [data, setData] = useState<HqTenantUsageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<HqTenantUsageDto[]>("/hq/tenants/usage")
      .then((response) => {
        if (mounted) setData(response.data);
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message ?? "Kullanım verileri alınamadı.");
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-800">HQ — Kullanım Raporu</h1>
        <p className="text-sm text-slate-500">
          Şubelerin öğrenci kayıtları ve aktiflik oranlarını analiz edin.
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
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((item) => (
            <div
              key={item.tenantId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{item.tenantName}</h2>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{item.tenantId}</p>
                </div>
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {item.activeStudents} aktif / {item.totalStudents}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-600">
                <div>
                  <dt className="font-medium text-slate-500">Aktif Öğrenci</dt>
                  <dd className="text-lg font-semibold text-emerald-600">{item.activeStudents}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Toplam Öğrenci</dt>
                  <dd className="text-lg font-semibold text-slate-700">{item.totalStudents}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-medium text-slate-500">Son Kayıt</dt>
                  <dd>
                    {item.lastStudentCreatedAt
                      ? new Date(item.lastStudentCreatedAt).toLocaleString("tr-TR")
                      : "Henüz kayıt yok"}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


