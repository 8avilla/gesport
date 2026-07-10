"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
  EXPIRADA: "Expirada",
};

const STATUS_COLOR: Record<string, string> = {
  PENDIENTE_PAGO: "#f59e0b",
  CONFIRMADA: "#059669",
  EN_CURSO: "#3b82f6",
  FINALIZADA: "#6b7280",
  CANCELADA: "#ef4444",
  NO_SHOW: "#b91c1c",
  EXPIRADA: "#9ca3af",
};

function currency(value: number): string {
  return `$${value.toLocaleString("es-CO")}`;
}

export function RevenueBarChart({
  data,
}: {
  data: { label: string; canchas: number; barra: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
        />
        <Tooltip formatter={(value) => currency(Number(value))} cursor={{ fill: "#f3f4f6" }} />
        <Bar dataKey="canchas" name="Canchas" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar dataKey="barra" name="Barra" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonutChart({ data }: { data: { status: string; count: number }[] }) {
  const nonZero = data.filter((entry) => entry.count > 0);

  if (nonZero.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Sin reservas hoy.</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={130} height={130}>
        <PieChart>
          <Pie data={nonZero} dataKey="count" nameKey="status" innerRadius={38} outerRadius={62} paddingAngle={2}>
            {nonZero.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? "#9ca3af"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => [
              Number(value),
              STATUS_LABEL[item.payload.status] ?? item.payload.status,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul className="grid flex-1 gap-1.5 text-sm">
        {nonZero.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[entry.status] ?? "#9ca3af" }}
            />
            <span className="truncate text-gray-600">{STATUS_LABEL[entry.status] ?? entry.status}</span>
            <span className="ml-auto font-medium text-gray-900">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
