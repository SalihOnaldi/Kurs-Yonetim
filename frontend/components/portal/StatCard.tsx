"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  accent?: string;
  icon?: string;
  footer?: string;
}

export default function StatCard({ title, value, accent = "from-emerald-500 to-teal-500", icon, footer }: StatCardProps) {
  return (
    <div className={`rounded-2xl shadow-lg border border-emerald-100 bg-gradient-to-br ${accent} text-white p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wide">{title}</h3>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {footer && <div className="text-xs text-white/80">{footer}</div>}
    </div>
  );
}


