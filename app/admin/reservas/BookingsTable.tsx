import Link from "next/link";
import { cancelConfirmedBooking, confirmSolicitud } from "@/lib/admin/actions";
import { BookingStatus } from "@/lib/booking/state-machine";
import { getPaymentState, PAYMENT_STATE_BADGE_STYLE, PAYMENT_STATE_LABEL, STATUS_BADGE_STYLE, STATUS_LABEL } from "@/lib/booking/status-display";
import { VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { SubmitButton } from "@/app/components/SubmitButton";
import { DateRangeFilterFields } from "./DateRangeFilterFields";

// Tope defensivo para "todas las reservas" sin filtro de fecha — evita traer miles de documentos si
// el negocio lleva años operando. No es paginación real (nadie necesita hojear reservas viejas de a
// 20 en 20 aquí); si se llega al tope, se le sugiere al admin acotar con los filtros.
export const BOOKING_LIST_LIMIT = 300;

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

type BookingRow = {
  id: string;
  date: Date;
  startTime: string;
  customerName: string;
  customerPhone: string;
  status: string;
  recurringBookingId: string | null;
  venue: { id: string; name: string };
  totalAmount: number;
  depositAmount: number;
};

// CANCELADA/NO_SHOW/EXPIRADA no entran en el modelo de estado de pago (getPaymentState devuelve
// null) — para esas se cae al STATUS_LABEL/STATUS_BADGE_STYLE de siempre.
function StatusBadge({ status, totalAmount, depositAmount }: { status: string; totalAmount: number; depositAmount: number }) {
  const paymentState = getPaymentState({ status, totalAmount, depositAmount });
  const label = paymentState ? PAYMENT_STATE_LABEL[paymentState] : (STATUS_LABEL[status] ?? status);
  const badgeStyle = paymentState
    ? PAYMENT_STATE_BADGE_STYLE[paymentState]
    : (STATUS_BADGE_STYLE[status] ?? "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200");

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyle}`}>
      {label}
    </span>
  );
}

export function BookingsTable({
  venues,
  bookings,
  truncated,
  isSingleDay,
  filters,
  hasActiveFilters,
}: {
  venues: { id: string; name: string }[];
  bookings: BookingRow[];
  truncated: boolean;
  isSingleDay: boolean;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    venueId?: string;
    type?: string;
    status?: string;
    name?: string;
    phone?: string;
  };
  hasActiveFilters: boolean;
}) {
  // Campos ocultos que preservan los filtros activos al cancelar una reserva desde la lista, para
  // que el admin no pierda su vista actual (rango de fechas, cancha, tipo, estado, búsqueda).
  const cancelFilterFields = (
    <>
      <input type="hidden" name="dateFrom" value={filters.dateFrom ?? ""} />
      <input type="hidden" name="dateTo" value={filters.dateTo ?? ""} />
      {filters.venueId && <input type="hidden" name="venueId" value={filters.venueId} />}
      {filters.type && <input type="hidden" name="type" value={filters.type} />}
      {filters.status && <input type="hidden" name="status" value={filters.status} />}
      {filters.name && <input type="hidden" name="name" value={filters.name} />}
      {filters.phone && <input type="hidden" name="phone" value={filters.phone} />}
    </>
  );

  return (
    <div className="grid gap-4">
      <form
        method="get"
        className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4 lg:grid-cols-7"
      >
        <DateRangeFilterFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} />

        <div>
          <label className="block text-xs font-medium text-gray-500">🏟️ Cancha</label>
          <select name="venueId" defaultValue={filters.venueId ?? ""} className={INPUT_CLASS}>
            <option value="">Todas</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">🏷️ Tipo de cancha</label>
          <select name="type" defaultValue={filters.type ?? ""} className={INPUT_CLASS}>
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
          <select name="status" defaultValue={filters.status ?? ""} className={INPUT_CLASS}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">👤 Nombre</label>
          <input
            type="text"
            name="name"
            defaultValue={filters.name ?? ""}
            placeholder="Contiene…"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">📱 Teléfono</label>
          <input
            type="text"
            name="phone"
            defaultValue={filters.phone ?? ""}
            placeholder="Contiene…"
            className={INPUT_CLASS}
          />
        </div>

        <div className="col-span-2 flex items-end gap-3 sm:col-span-4 lg:col-span-7">
          <SubmitButton
            pendingLabel="Filtrando…"
            className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Filtrar
          </SubmitButton>
          {hasActiveFilters && (
            <Link href="/admin/reservas?vista=lista" className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-gray-500">
        {bookings.length} {bookings.length === 1 ? "reserva encontrada" : "reservas encontradas"}
        {truncated && " (mostrando las primeras — acota los filtros para ver el resto)"}
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {bookings.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">📭</div>
            <p className="mt-2 text-sm text-gray-500">Sin reservas para estos filtros.</p>
          </div>
        ) : (
          <>
            {/* Tabla en pantallas medianas o más grandes */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Horario</th>
                  <th className="px-4 py-3">Cancha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {!isSingleDay && (
                        <div className="text-xs font-normal text-gray-400">
                          {booking.date.toISOString().slice(0, 10)}
                        </div>
                      )}
                      {booking.startTime}
                    </td>
                    <td className="px-4 py-3">
                      {booking.recurringBookingId && <span title="Reserva recurrente">🔁 </span>}
                      {booking.venue.name}
                    </td>
                    <td className="px-4 py-3">{booking.customerName}</td>
                    <td className="px-4 py-3 text-gray-500">{booking.customerPhone}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={booking.status} totalAmount={booking.totalAmount} depositAmount={booking.depositAmount} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {booking.status === BookingStatus.CONFIRMADA && (
                        <form action={cancelConfirmedBooking} className="inline">
                          <input type="hidden" name="bookingId" value={booking.id} />
                          {cancelFilterFields}
                          <SubmitButton
                            pendingLabel="Cancelando…"
                            confirmMessage="¿Cancelar esta reserva confirmada?"
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white
                              hover:bg-red-700"
                          >
                            Cancelar
                          </SubmitButton>
                        </form>
                      )}
                      {booking.status === BookingStatus.SOLICITADA && (
                        <div className="inline-flex gap-1.5">
                          <form action={confirmSolicitud} className="inline">
                            <input type="hidden" name="bookingId" value={booking.id} />
                            {cancelFilterFields}
                            <SubmitButton
                              pendingLabel="Confirmando…"
                              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white
                                hover:bg-emerald-800"
                            >
                              Confirmar
                            </SubmitButton>
                          </form>
                          <form action={cancelConfirmedBooking} className="inline">
                            <input type="hidden" name="bookingId" value={booking.id} />
                            {cancelFilterFields}
                            <SubmitButton
                              pendingLabel="Rechazando…"
                              confirmMessage="¿Rechazar esta solicitud?"
                              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white
                                hover:bg-red-700"
                            >
                              Rechazar
                            </SubmitButton>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tarjetas en mobile */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {bookings.map((booking) => (
                <li key={booking.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">
                      {booking.recurringBookingId && <span title="Reserva recurrente">🔁 </span>}
                      {booking.venue.name} — {!isSingleDay && `${booking.date.toISOString().slice(0, 10)} `}
                      {booking.startTime}
                    </span>
                    <StatusBadge status={booking.status} totalAmount={booking.totalAmount} depositAmount={booking.depositAmount} />
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {booking.customerName} · {booking.customerPhone}
                  </div>

                  {booking.status === BookingStatus.CONFIRMADA && (
                    <form action={cancelConfirmedBooking} className="mt-3">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      {cancelFilterFields}
                      <SubmitButton
                        pendingLabel="Cancelando…"
                        confirmMessage="¿Cancelar esta reserva confirmada?"
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Cancelar reserva
                      </SubmitButton>
                    </form>
                  )}
                  {booking.status === BookingStatus.SOLICITADA && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <form action={confirmSolicitud}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        {cancelFilterFields}
                        <SubmitButton
                          pendingLabel="Confirmando…"
                          className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                        >
                          Confirmar
                        </SubmitButton>
                      </form>
                      <form action={cancelConfirmedBooking}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        {cancelFilterFields}
                        <SubmitButton
                          pendingLabel="Rechazando…"
                          confirmMessage="¿Rechazar esta solicitud?"
                          className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          Rechazar
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
