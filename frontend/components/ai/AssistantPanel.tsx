"use client";

import { FormEvent, useMemo } from "react";

export interface AiHistoryEntry {
  id: number;
  question: string;
  answer: string;
  provider: string;
  createdAt: string;
  source?: string;
}

interface AssistantPanelProps {
  entries: AiHistoryEntry[];
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
}

const providerBadge = (provider: string) => {
  const normalized = provider?.toLowerCase() ?? "";
  switch (normalized) {
    case "openai":
      return "OpenAI";
    case "mock":
    default:
      return "Sanal Asistan";
  }
};

export default function AssistantPanel({
  entries,
  prompt,
  onPromptChange,
  onSubmit,
  submitting = false,
}: AssistantPanelProps) {
  const conversation = useMemo(() => {
    return entries
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [entries]);

  return (
    <section className="bg-white/80 backdrop-blur border border-emerald-100 shadow-xl rounded-2xl flex flex-col max-h-[70vh]">
      <header className="px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            Akıllı Asistan Sohbeti
          </h2>
          <p className="text-sm text-emerald-700">
            Kurs yönetimi, yoklama ve MEB işlemleri hakkında sorularınızı sorun.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {conversation.length === 0 && (
          <div className="border border-dashed border-emerald-200 rounded-2xl p-6 bg-emerald-50/50 text-sm text-emerald-700">
            Henüz bir sohbet yok. Aşağıdaki kutuya probleminizi yazarak konuşmaya başlayabilirsiniz.
          </div>
        )}

        {conversation.map((entry) => (
          <article key={entry.id} className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-emerald-600 uppercase tracking-wide">
              <span className="font-semibold">Siz</span>
              <span className="w-1 h-1 bg-emerald-300 rounded-full" />
              <span>{new Date(entry.createdAt).toLocaleString("tr-TR")}</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-emerald-100 text-emerald-900 shadow-sm">
              {entry.question}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide">
              <span className="font-semibold">{providerBadge(entry.provider)}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full" />
              <span>Yanıt</span>
            </div>
            <div className="px-4 py-4 rounded-2xl bg-slate-900/90 text-slate-50 shadow-lg whitespace-pre-line leading-relaxed">
              {entry.answer}
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={onSubmit} className="border-t border-emerald-100 px-6 py-4 space-y-3">
        <label className="block text-sm font-semibold text-emerald-900">
          Sorunuz
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Örnek: Bu hafta hangi kurslar başlıyor ve yoklama oranı düşük sınıflar hangileri?"
            rows={3}
            className="mt-2 w-full px-4 py-3 border-2 border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm resize-none bg-white"
            disabled={submitting}
          />
        </label>
        <div className="flex items-center justify-between">
          <p className="text-xs text-emerald-600">
            Yanıtlar haftalık özet verileriyle desteklenir. Sorular Türkçe olarak yanıtlanır.
          </p>
          <button
            type="submit"
            disabled={submitting || !prompt.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold shadow-md hover:from-emerald-700 hover:to-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                Yanıtlanıyor...
              </>
            ) : (
              <>
                <span>Yanıtla</span>
                <span className="text-lg">↵</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}


