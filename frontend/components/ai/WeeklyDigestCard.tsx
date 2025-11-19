"use client";

interface WeeklyDigestCardProps {
  title: string;
  description: string;
  icon?: string;
  highlights: string[];
  generatedAt?: string;
}

export default function WeeklyDigestCard({
  title,
  description,
  icon = "🧠",
  highlights,
  generatedAt,
}: WeeklyDigestCardProps) {
  return (
    <article className="bg-white/80 backdrop-blur border border-emerald-100 rounded-2xl shadow-lg p-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
            <span className="text-2xl leading-none">{icon}</span>
            {title}
          </h3>
          <p className="text-sm text-emerald-700 mt-1">{description}</p>
        </div>
        {generatedAt && (
          <span className="text-xs text-emerald-500 font-medium">
            {new Date(generatedAt).toLocaleString("tr-TR")}
          </span>
        )}
      </header>

      <ul className="space-y-2 text-sm text-slate-700">
        {highlights.length === 0 && (
          <li className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-dashed border-emerald-200">
            Bu başlık için paylaşılacak ek bilgi bulunamadı.
          </li>
        )}
        {highlights.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-white border border-emerald-100 text-emerald-900"
          >
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}


