"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface PortalLoginResponse {
  studentId: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

export default function PortalLoginPage() {
  const router = useRouter();
  const [tc, setTc] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tc.trim()) {
      setError("TC Kimlik numarası gereklidir.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await api.post<PortalLoginResponse>("/portal/login", {
        tcKimlikNo: tc.trim(),
        email: email.trim() || undefined,
      });
      const payload = {
        studentId: response.data.studentId,
        tcKimlikNo: tc.trim(),
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        email: response.data.email,
        phone: response.data.phone,
      };
      localStorage.setItem("portalStudent", JSON.stringify(payload));
      router.push("/portal/dashboard");
    } catch (err: any) {
      console.error("Portal login error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Giriş bilgileri doğrulanamadı. Lütfen tekrar deneyin."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur border border-emerald-100 rounded-3xl shadow-2xl p-8 space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-emerald-900">Kursiyer Portalı</h1>
          <p className="text-sm text-emerald-700">
            Ders programınızı, yoklama durumunuzu ve belgelerinizi görüntülemek için giriş yapın.
          </p>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              TC Kimlik No <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={tc}
              onChange={(event) => setTc(event.target.value)}
              placeholder="11 haneli TC Kimlik numaranız"
              className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={11}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              E-posta (opsiyonel)
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Sistemde kayıtlı e-posta adresiniz"
              className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:from-emerald-700 hover:to-green-700 disabled:opacity-60"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <div className="text-xs text-emerald-600 text-center">
          Giriş yaparken sorun yaşıyorsanız kurs yönetimi ile iletişime geçin.
        </div>
      </div>
    </div>
  );
}


