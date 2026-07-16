import Link from "next/link";
import { STATUS_BADGE_STYLE, STATUS_LABEL } from "@/lib/booking/status-display";
import { VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { SubmitButton } from "@/app/components/SubmitButton";
import type { BookingReportRow } from "@/lib/admin/queries";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

const METODO_PAGO_OPTIONS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DATAFONO", label: "Datáfono" },
  { value: "BOLD", label: "Bold" },
  { value: "COMPROBANTE_MANUAL", label: "Comprobante manual" },
] as const;

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_BADGE_STYLE[status] ?? "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function BookingsReportTable({
  venues,
  rows,
  truncated,
  filters,
  hasActiveFilters,
}: {
  venues: { id: string; name: string }[];
  rows: BookingReportRow[];
  truncated: boolean;
  filters: {
    dateFrom: string;
    dateTo: string;
    venueId?: string;
    type?: string;
    status?: string;
    paymentMethod?: string;
    name?: string;
    phone?: string;
  };
  hasActiveFilters: boolean;
}) {
  const totalPaid = rows.reduce((sum, r) => sum + r.totalPaid, 0);
  const totalContratado = rows.reduce((sum, r) => sum + r.totalAmount + r.consumptionTotal, 0);

  return (
    <div className="mt-8 grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Detalle de reservas</h2>
        <p className="text-xs text-gray-500">Filtra y exporta lo necesario para conciliar caja.</p>
      </div>

      <form
        method="get"
        className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4 lg:grid-cols-8"
      >
        <div>
          <label className="block text-xs font-medium text-gray-500">📅 Desde</label>
          <input type="date" name="repFrom" defaultValue={filters.dateFrom} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">📅 Hasta</label>
          <input type="date" name="repTo" defaultValue={filters.dateTo} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">🏟️ Cancha</label>
          <select name="repVenue" defaultValue={filters.venueId ?? ""} className={INPUT_CLASS}>
            <option value="">Todas</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">🏷️ Tipo</label>
          <select name="repType" defaultValue={filters.type ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {Object.entries(VENUE_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">🚦 Estado</label>
          <select name="repStatus" defaultValue={filters.status ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">💳 Método de pago</label>
          <select name="repMetodo" defaultValue={filters.paymentMethod ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {METODO_PAGO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">👤 Cliente</label>
          <input
            type="text"
            name="repName"
            defaultValue={filters.name ?? ""}
            placeholder="Nombre…"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">📱 Teléfono</label>
          <input
            type="text"
            name="repPhone"
            defaultValue={filters.phone ?? ""}
            placeholder="Contiene…"
            className={INPUT_CLASS}
          />
        </div>

        <div className="col-span-2 flex items-end gap-3 sm:col-span-4 lg:col-span-8">
          <SubmitButton
            pendingLabel="Filtrando…"
            className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Filtrar
          </SubmitButton>
          {hasActiveFilters && (
            <Link href="/admin/reportes" className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
          <span className="ml-auto self-center text-sm text-gray-500">
            {rows.length} {rows.length === 1 ? "reserva" : "reservas"}
            {truncated && " (primeras — acota los filtros para ver el resto)"}
          </span>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">Total cobrado (filtro actual)</div>
          <div className="mt-1 text-xl font-semibold text-emerald-700">${totalPaid.toLocaleString("es-CO")}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">Valor total contratado (canchas + barra)</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">${totalContratado.toLocaleString("es-CO")}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">📭</div>
            <p className="mt-2 text-sm text-gray-500">Sin reservas para estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Fecha</th>
                  <th className="whitespace-nowrap px-4 py-3">Hora</th>
                  <th className="whitespace-nowrap px-4 py-3">Cancha</th>
                  <th className="whitespace-nowrap px-4 py-3">Tipo</th>
                  <th className="whitespace-nowrap px-4 py-3">Cliente</th>
                  <th className="whitespace-nowrap px-4 py-3">Estado</th>
                  <th className="whitespace-nowrap px-4 py-3">Método de pago</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Total pagado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{row.date}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {row.startTime}-{row.endTime}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{row.venueName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {VENUE_TYPE_LABEL[row.venueType] ?? row.venueType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div>{row.customerName}</div>
                      <div className="text-xs text-gray-400">{row.customerPhone}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{row.paymentMethodLabel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-900">
                      ${row.totalPaid.toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-900">
                  <td className="px-4 py-3" colSpan={7}>
                    Total cobrado
                  </td>
                  <td className="px-4 py-3 text-right">${totalPaid.toLocaleString("es-CO")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
