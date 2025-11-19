"use client";

interface Kpi {
  title: string;
  value: string | number;
  icon?: string;
  tone?: "emerald" | "teal" | "amber" | "rose";
  description?: string;
}

const toneMap: Record<NonNullable<Kpi["tone"]>, string> = {
  emerald: "from-emerald-500 to-green-500",
  teal: "from-teal-500 to-cyan-500",
  amber: "from-amber-500 to-orange-500",
  rose: "from-rose-500 to-pink-500",
};

interface KpiCardsProps {
  items: Kpi[];
}

export default function KpiCards({ items }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.title}
          className={`rounded-2xl shadow-lg border border-emerald-100 bg-gradient-to-br ${
            toneMap[item.tone ?? "emerald"]
          } text-white p-5 space-y-2`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wide">{item.title}</h3>
            {item.icon && <span className="text-xl">{item.icon}</span>}
          </div>
          <div className="text-3xl font-bold">{item.value}</div>
          {item.description && <div className="text-xs text-white/80">{item.description}</div>}
        </div>
      ))}
    </div>
  );
}


