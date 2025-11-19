"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ImpersonatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Lisans hesabına geçiş hazırlanıyor...");

  useEffect(() => {
    const token = searchParams.get("token");
    const tenantId = searchParams.get("tenantId");

    if (!token || !tenantId) {
      setMessage("Geçersiz veya eksik impersonation verisi.");
      return;
    }

    localStorage.setItem("token", token);
    localStorage.setItem("tenantId", tenantId);
    localStorage.setItem("impersonating", "true");

    setTimeout(() => {
      router.replace("/dashboard");
    }, 800);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="rounded-lg bg-white px-8 py-10 text-center shadow-xl">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">
          🔐
        </div>
        <p className="text-lg font-semibold text-slate-800">{message}</p>
        <p className="mt-2 text-sm text-slate-500">
          Bu pencere otomatik olarak kurs paneline yönlendirilecektir.
        </p>
      </div>
    </div>
  );
}


