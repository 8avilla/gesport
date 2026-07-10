import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDashboardMetrics, getRevenueReport } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { RevenueBarChart, StatusDonutChart } from "./DashboardCharts";

const REVENUE_CHART_DAYS = 7;

export default async function AdminDashboardPage() {
  const { orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const [metrics, revenueReport] = await Promise.all([
    getDashboardMetrics(organization.id),
    getRevenueReport(organization.id, REVENUE_CHART_DAYS),
  ]);

  const totalBookingsToday = Object.values(metrics.bookingsByStatus).reduce((sum, count) => sum + count, 0);

  const statCards = [
    { icon: "💵", label: "Ingresos canchas hoy", value: `$${metrics.courtsRevenueToday.toLocaleString("es-CO")}` },
    { icon: "🥤", label: "Ingresos barra hoy", value: `$${metrics.barRevenueToday.toLocaleString("es-CO")}` },
    { icon: "📅", label: "Reservas hoy", value: String(totalBookingsToday) },
    { icon: "🗄️", label: "Turno de caja", value: metrics.openShift ? "Abierto" : "Cerrado" },
  ];

  const chartData = revenueReport.map((day) => ({
    label: formatBusinessDayLabel(day.date).weekday,
    canchas: day.courtsTotal,
    barra: day.barTotal,
  }));

  const donutData = Object.entries(metrics.bookingsByStatus).map(([status, count]) => ({ status, count }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard — {organization.name}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-lg">
              {card.icon}
            </div>
            <div className="mt-3 text-xl font-semibold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-700">Ingresos de los últimos {REVENUE_CHART_DAYS} días</h2>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" /> Canchas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" /> Barra
            </span>
          </div>
          <div className="mt-2">
            <RevenueBarChart data={chartData} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700">Reservas de hoy por estado</h2>
          <div className="mt-3">
            <StatusDonutChart data={donutData} />
          </div>
        </div>
      </div>

      {metrics.lowStockProducts.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">⚠️ Alertas de inventario bajo</h2>
          <ul className="mt-2 grid gap-1 text-sm text-amber-800">
            {metrics.lowStockProducts.map((product) => (
              <li key={product.id}>
                {product.name}: quedan {product.stock} (umbral {product.lowStockThreshold})
              </li>
            ))}
          </ul>
          <Link href="/admin/inventario" className="mt-2 inline-block text-sm text-blue-700 underline">
            Ir a inventario
          </Link>
        </div>
      )}
    </main>
  );
}
