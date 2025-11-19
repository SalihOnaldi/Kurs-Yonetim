"use client";

interface TimelineItem {
  id: string | number;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  badgeTone?: "success" | "warning" | "info" | "danger";
}

interface TimelineProps {
  title: string;
  description?: string;
  items: TimelineItem[];
  emptyMessage: string;
}

const toneClasses: Record<NonNullable<TimelineItem["badgeTone"]>, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-sky-100 text-sky-700",
  danger: "bg-rose-100 text-rose-700",
};

export default function Timeline({ title, description, items, emptyMessage }: TimelineProps) {
  return (
    <div className="bg-white/90 backdrop-blur border border-emerald-100 rounded-2xl shadow-xl p-5 space-y-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-emerald-900">{title}</h3>
        {description && <p className="text-sm text-emerald-700">{description}</p>}
      </header>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-emerald-700 border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/70">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="relative pl-6">
              <span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-emerald-500" />
              <div className="text-sm font-semibold text-emerald-900">{item.title}</div>
              {item.subtitle && <div className="text-xs text-emerald-700 mt-0.5">{item.subtitle}</div>}
              <div className="mt-1 flex items-center gap-2 text-xs text-emerald-600">
                {item.meta && <span>{item.meta}</span>}
                {item.badge && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.badgeTone ? toneClasses[item.badgeTone] : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


