"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [forgotPasswordUsername, setForgotPasswordUsername] = useState("");
  const [forgotPasswordChannel, setForgotPasswordChannel] = useState<"email" | "sms">("email");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { username, password });
      const { accessToken, tenantId, tenants, user } = response.data;

      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      if (Array.isArray(tenants)) {
        localStorage.setItem("tenants", JSON.stringify(tenants));
      }

      const resolvedTenantId =
        tenantId ?? (Array.isArray(tenants) && tenants.length > 0 ? tenants[0] : null);
      if (resolvedTenantId) {
        localStorage.setItem("tenantId", resolvedTenantId);
      }

      if (user.role === "PlatformOwner") {
        router.push("/hq/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-2xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl text-white">🎓</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            SRC Kurs Yönetim Sistemi
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Hesabınıza giriş yapın
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <span className="mr-2">⚠️</span>
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Kullanıcı Adı
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none relative block w-full px-4 py-3 border-2 border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Kullanıcı adınızı girin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none relative block w-full px-4 py-3 border-2 border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setForgotPasswordOpen(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Şifrenizi mi unuttunuz?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Giriş yapılıyor...
                </span>
              ) : (
                "Giriş Yap"
              )}
            </button>
          </div>
        </form>
        <div className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          <p className="font-semibold">Örnek hesaplar</p>
          <ul className="mt-2 space-y-1">
            <li>
              <span className="font-medium">Yönetim (PlatformOwner):</span> kullanıcı adı{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs text-indigo-800">admin</code>, şifre{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs text-indigo-800">Admin123!</code>
            </li>
            <li>
              <span className="font-medium">Şube (BranchAdmin):</span> kullanıcı adı{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs text-indigo-800">admin.kurs</code>, şifre{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs text-indigo-800">Kurs123!</code>
            </li>
          </ul>
        </div>
      </div>

      {/* Şifre Sıfırlama Modal */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Şifre Sıfırlama</h3>
            
            {!forgotPasswordSuccess ? (
              <>
                <p className="text-gray-600 mb-6">
                  Şifre sıfırlama kodunuzu almak için kullanıcı adınızı girin ve gönderim kanalını seçin.
                </p>
                
                {forgotPasswordError && (
                  <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {forgotPasswordError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={forgotPasswordUsername}
                      onChange={(e) => setForgotPasswordUsername(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Kullanıcı adınızı girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gönderim Kanalı
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="email"
                          checked={forgotPasswordChannel === "email"}
                          onChange={(e) => setForgotPasswordChannel(e.target.value as "email" | "sms")}
                          className="mr-2"
                        />
                        <span>E-posta</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="sms"
                          checked={forgotPasswordChannel === "sms"}
                          onChange={(e) => setForgotPasswordChannel(e.target.value as "email" | "sms")}
                          className="mr-2"
                        />
                        <span>SMS</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setForgotPasswordOpen(false);
                      setForgotPasswordUsername("");
                      setForgotPasswordError("");
                    }}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    onClick={async () => {
                      if (!forgotPasswordUsername.trim()) {
                        setForgotPasswordError("Kullanıcı adı gereklidir.");
                        return;
                      }

                      setForgotPasswordLoading(true);
                      setForgotPasswordError("");
                      try {
                        await api.post("/auth/forgot-password", {
                          username: forgotPasswordUsername,
                          channel: forgotPasswordChannel,
                        });
                        setForgotPasswordSuccess("Şifre sıfırlama kodu gönderildi. Lütfen kontrol edin.");
                        setTimeout(() => {
                          setForgotPasswordOpen(false);
                          setResetPasswordOpen(true);
                        }, 2000);
                      } catch (err: any) {
                        setForgotPasswordError(err.response?.data?.message || "Bir hata oluştu.");
                      } finally {
                        setForgotPasswordLoading(false);
                      }
                    }}
                    disabled={forgotPasswordLoading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                  >
                    {forgotPasswordLoading ? "Gönderiliyor..." : "Gönder"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-green-600 text-lg mb-4">{forgotPasswordSuccess}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Şifre Sıfırlama Kodu Modal */}
      {resetPasswordOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Yeni Şifre Belirle</h3>
            
            {resetPasswordSuccess ? (
              <div className="text-center">
                <div className="text-green-600 text-lg mb-4">{resetPasswordSuccess}</div>
                <button
                  onClick={() => {
                    setResetPasswordOpen(false);
                    setResetToken("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setResetPasswordSuccess("");
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg"
                >
                  Tamam
                </button>
              </div>
            ) : (
              <>
                {resetPasswordError && (
                  <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {resetPasswordError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={forgotPasswordUsername}
                      readOnly
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Şifre Sıfırlama Kodu
                    </label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="6 haneli kodu girin"
                      maxLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Yeni Şifre
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Yeni şifrenizi girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Yeni Şifre (Tekrar)
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Yeni şifrenizi tekrar girin"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setResetPasswordOpen(false);
                      setResetToken("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setResetPasswordError("");
                    }}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    onClick={async () => {
                      if (!resetToken.trim() || !newPassword.trim() || !confirmPassword.trim()) {
                        setResetPasswordError("Tüm alanlar gereklidir.");
                        return;
                      }

                      if (newPassword !== confirmPassword) {
                        setResetPasswordError("Şifreler eşleşmiyor.");
                        return;
                      }

                      if (newPassword.length < 6) {
                        setResetPasswordError("Şifre en az 6 karakter olmalıdır.");
                        return;
                      }

                      setResetPasswordLoading(true);
                      setResetPasswordError("");
                      try {
                        await api.post("/auth/reset-password", {
                          username: forgotPasswordUsername,
                          token: resetToken,
                          newPassword: newPassword,
                        });
                        setResetPasswordSuccess("Şifre başarıyla sıfırlandı. Giriş yapabilirsiniz.");
                      } catch (err: any) {
                        setResetPasswordError(err.response?.data?.message || "Bir hata oluştu.");
                      } finally {
                        setResetPasswordLoading(false);
                      }
                    }}
                    disabled={resetPasswordLoading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                  >
                    {resetPasswordLoading ? "Sıfırlanıyor..." : "Şifreyi Sıfırla"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

