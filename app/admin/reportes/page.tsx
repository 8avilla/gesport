import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getBookingsReport, getPaymentMethodBreakdown, getRevenueReport } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { BookingStatus } from "@/lib/booking/state-machine";
import { todayBusinessDate } from "@/lib/time/business-day";
import { VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { RevenueBarChart, StatusDonutChart } from "../DashboardCharts";
import { BookingsReportTable } from "./BookingsReportTable";

const RANGE_OPTIONS = [7, 14, 30, 90];
const DEFAULT_DAYS = 14;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    dias?: string;
    repFrom?: string;
    repTo?: string;
    repVenue?: string;
    repType?: string;
    repStatus?: string;
    repMetodo?: string;
    repName?: string;
    repPhone?: string;
  }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const {
    dias,
    repFrom,
    repTo,
    repVenue,
    repType,
    repStatus,
    repMetodo,
    repName,
    repPhone,
  } = await searchParams;
  const days = RANGE_OPTIONS.includes(Number(dias)) ? Number(dias) : DEFAULT_DAYS;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });
  const venueIds = new Set(venues.map((v) => v.id));

  // Reporte de detalle: por defecto, mes en curso — el rango típico para "sacar cuentas".
  const today = todayBusinessDate();
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const reportDateFrom = repFrom && DATE_RE.test(repFrom) ? repFrom : defaultFrom;
  const reportDateTo = repTo && DATE_RE.test(repTo) ? repTo : today;
  const reportVenueId = repVenue && venueIds.has(repVenue) ? repVenue : undefined;
  const reportType = repType && repType in VENUE_TYPE_LABEL ? repType : undefined;
  const reportStatus =
    repStatus && (Object.values(BookingStatus) as string[]).includes(repStatus)
      ? (repStatus as BookingStatus)
      : undefined;
  const reportMetodo = repMetodo || undefined;
  const reportName = repName?.trim() || undefined;
  const reportPhone = repPhone?.trim() || undefined;

  const hasReportFilters = Boolean(
    repFrom || repTo || reportVenueId || reportType || reportStatus || reportMetodo || reportName || reportPhone,
  );

  const [report, paymentBreakdown, bookingsReport] = await Promise.all([
    getRevenueReport(organization.id, days),
    getPaymentMethodBreakdown(organization.id, days),
    getBookingsReport(organization.id, {
      dateFrom: reportDateFrom,
      dateTo: reportDateTo,
      venueId: reportVenueId,
      type: reportType,
      status: reportStatus,
      paymentMethod: reportMetodo,
      name: reportName,
      phone: reportPhone,
    }),
  ]);

  const totalCourts = report.reduce((sum, day) => sum + day.courtsTotal, 0);
  const totalBar = report.reduce((sum, day) => sum + day.barTotal, 0);
  const totalPayments = paymentBreakdown.cash + paymentBreakdown.transfer + paymentBreakdown.card;

  const chartData = report.map((day) => ({
    label: day.date.slice(5).replace("-", "/"),
    canchas: day.courtsTotal,
    barra: day.barTotal,
  }));

  const statusTotals: Record<string, number> = {};
  for (const day of report) {
    for (const [status, count] of Object.entries(day.statusCounts)) {
      statusTotals[status] = (statusTotals[status] ?? 0) + count;
    }
  }
  const donutData = Object.entries(statusTotals).map(([status, count]) => ({ status, count }));

  return (
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reportes</h1>
        <div className="flex gap-1.5">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option}
              href={`/admin/reportes?dias=${option}`}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                option === days ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700"
              }`}
            >
              {option}d
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Total canchas: ${totalCourts.toLocaleString("es-CO")} · Total barra: $
        {totalBar.toLocaleString("es-CO")}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-700">Ingresos por día</h2>
          <div className="mt-2">
            <RevenueBarChart data={chartData} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700">Reservas por estado</h2>
          <div className="mt-3">
            <StatusDonutChart data={donutData} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700">Método de pago (turnos de caja cerrados)</h2>
        {totalPayments === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Sin turnos cerrados en este rango.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Efectivo</div>
              <div className="font-medium text-gray-900">${paymentBreakdown.cash.toLocaleString("es-CO")}</div>
            </div>
            <div>
              <div className="text-gray-500">Transferencia</div>
              <div className="font-medium text-gray-900">${paymentBreakdown.transfer.toLocaleString("es-CO")}</div>
            </div>
            <div>
              <div className="text-gray-500">Datáfono</div>
              <div className="font-medium text-gray-900">${paymentBreakdown.card.toLocaleString("es-CO")}</div>
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 whitespace-nowrap">Fecha</th>
                <th className="py-2 pr-4 whitespace-nowrap">Canchas</th>
                <th className="py-2 pr-4 whitespace-nowrap">Barra</th>
                <th className="py-2 pr-4 whitespace-nowrap">Finalizadas</th>
                <th className="py-2 pr-4 whitespace-nowrap">Canceladas</th>
                <th className="py-2 pr-4 whitespace-nowrap">No-show</th>
              </tr>
            </thead>
            <tbody>
              {report.map((day) => (
                <tr key={day.date} className="border-b border-gray-100">
                  <td className="py-2 pr-4 whitespace-nowrap">{day.date}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">${day.courtsTotal.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">${day.barTotal.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{day.finalizadas}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{day.canceladas}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{day.noShow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Aviso de que hay más columnas a la derecha (ej. No-show) fuera de la vista en móvil. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
      </div>

      <BookingsReportTable
        venues={venues}
        rows={bookingsReport.rows}
        truncated={bookingsReport.truncated}
        filters={{
          dateFrom: reportDateFrom,
          dateTo: reportDateTo,
          venueId: reportVenueId,
          type: reportType,
          status: reportStatus,
          paymentMethod: reportMetodo,
          name: reportName,
          phone: reportPhone,
        }}
        hasActiveFilters={hasReportFilters}
      />
    </main>
  );
}
