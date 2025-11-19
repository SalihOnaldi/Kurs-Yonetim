"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import AssistantPanel, { AiHistoryEntry } from "@/components/ai/AssistantPanel";
import WeeklyDigestCard from "@/components/ai/WeeklyDigestCard";

interface WeeklyDigestSection {
  title: string;
  description: string;
  icon: string;
  highlights: string[];
}

interface WeeklyDigestResponse {
  generatedAt: string;
  sections: WeeklyDigestSection[];
}

export default function AiAssistantPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AiHistoryEntry[]>([]);
  const [digest, setDigest] = useState<WeeklyDigestResponse | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me")
      .then(() => {
        setAuthorized(true);
        loadInitialData();
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = async () => {
    try {
      setError("");
      const [historyRes, digestRes] = await Promise.all([
        api.get<AiHistoryEntry[]>("/ai/history?take=20"),
        api.get<WeeklyDigestResponse>("/ai/weekly-digest"),
      ]);
      setHistory(historyRes.data || []);
      setDigest(digestRes.data || null);
    } catch (err: any) {
      console.error("AI assistant init error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Yapay zekâ asistanı verileri yüklenirken bir hata oluştu.";
      setError(message);
    }
  };

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!prompt.trim()) {
      setError("Lütfen bir soru yazın.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await api.post<AiHistoryEntry>("/ai/ask", {
        question: prompt.trim(),
      });

      setHistory((prev) => [
        {
          id: response.data.id ?? Date.now(),
          question: response.data.question,
          answer: response.data.answer,
          provider: response.data.provider,
          createdAt: response.data.createdAt,
        },
        ...prev,
      ]);
      setPrompt("");

      // Refresh digest asynchronously (don't block response)
      api
        .get<WeeklyDigestResponse>("/ai/weekly-digest")
        .then((res) => setDigest(res.data))
        .catch((err) =>
          console.warn("Weekly digest refresh failed:", err.response?.data || err.message)
        );
    } catch (err: any) {
      console.error("AI ask error:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Sorunuz yanıtlanırken bir hata oluştu. Lütfen tekrar deneyin.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const digestSections = useMemo(() => digest?.sections ?? [], [digest?.sections]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <div className="text-lg text-emerald-800 font-medium">Asistan hazırlanıyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100">
      <nav className="bg-white/90 backdrop-blur border-b border-emerald-100 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => router.push("/menu")}
              className="text-emerald-600 hover:text-emerald-800 font-medium"
            >
              ← Ana Menü
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-emerald-900 flex items-center gap-2">
              <span className="text-3xl">🧠</span>
              Yapay Zekâ Asistanı
            </h1>
            <button
              onClick={loadInitialData}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              Yenile
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <AssistantPanel
                entries={history}
                prompt={prompt}
                onPromptChange={setPrompt}
                onSubmit={handleAsk}
                submitting={submitting}
              />
            </div>
            <aside className="lg:col-span-2 space-y-4">
              <div className="bg-white/80 backdrop-blur border border-emerald-100 rounded-2xl shadow-lg px-5 py-4">
                <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                  <span className="text-2xl">📬</span>
                  Haftalık Özet
                </h2>
                <p className="text-sm text-emerald-700 mt-1">
                  Sistem verileri analiz edilerek öne çıkan operasyonel maddeler listelenir.
                  Özeti dilediğiniz zaman yenileyebilirsiniz.
                </p>
                {digest?.generatedAt && (
                  <p className="text-xs text-emerald-500 mt-2">
                    Son güncelleme:{" "}
                    {new Date(digest.generatedAt).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              {digestSections.map((section, index) => (
                <WeeklyDigestCard
                  key={`${section.title}-${index}`}
                  title={section.title}
                  description={section.description}
                  icon={section.icon}
                  highlights={section.highlights}
                  generatedAt={digest?.generatedAt}
                />
              ))}

              {digestSections.length === 0 && (
                <div className="border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/60 px-4 py-6 text-sm text-emerald-700">
                  Şu anda öne çıkan bir özet bulunmuyor. Sistem verileri güncellendikçe bu bölümde
                  görünecek.
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}


