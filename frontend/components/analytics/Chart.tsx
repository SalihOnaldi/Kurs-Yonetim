"use client";

interface LineChartProps {
  labels: string[];
  datasetLabel: string;
  data: number[];
  color?: string;
}

export default function LineChart({ labels, datasetLabel, data, color = "#6366f1" }: LineChartProps) {
  const maxValue = Math.max(...data, 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-48 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 overflow-x-auto">
        {data.map((value, index) => {
          const height = `${Math.round((value / maxValue) * 100)}%`;
          return (
            <div key={labels[index]} className="flex flex-col items-center justify-end gap-2 min-w-[40px]">
              <div
                className="w-3 rounded-t-lg"
                style={{
                  height,
                  background: color,
                }}
                title={`${labels[index]} • ${value}`}
              />
              <span className="text-xs text-indigo-700 whitespace-nowrap">{value}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-indigo-700 px-1">
        {labels.map((label) => (
          <span key={label} className="whitespace-nowrap">
            {label}
          </span>
        ))}
      </div>
      <div className="text-xs text-indigo-500">{datasetLabel}</div>
    </div>
  );
}


