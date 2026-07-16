"use client";

import { CLOSING_HOUR, OPENING_HOUR } from "@/lib/booking/availability";
import { getPaymentState, PAYMENT_STATE_BLOCK_STYLE, PAYMENT_STATE_ICON, STATUS_BLOCK_STYLE, STATUS_ICON } from "@/lib/booking/status-display";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import type { AgendaBlockedSlot, AgendaBooking, AgendaVenue } from "@/lib/admin/queries";
import { useOpenReservaDrawer, useViewReserva } from "./ReservaDrawerProvider";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Un turno por hora en punto, siempre — mismo grid fijo que el resto del sistema (ver
// lib/booking/availability.ts). Cada celda de la tabla es exactamente un turno: o hay una reserva
// que empieza a esa hora, o la celda es "+ Libre".
const HOURS = Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) => `${pad(OPENING_HOUR + i)}:00`);

export function AgendaGrid({
  venues,
  bookingsByVenue,
  blockedByComboByVenue,
  dateIso,
}: {
  venues: AgendaVenue[];
  bookingsByVenue: Record<string, AgendaBooking[]>;
  blockedByComboByVenue: Record<string, Record<string, AgendaBlockedSlot>>;
  dateIso: string;
}) {
  const openDrawer = useOpenReservaDrawer();
  const viewReserva = useViewReserva();

  if (venues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Todavía no hay canchas creadas.
      </div>
    );
  }

  return (
    // [contain:layout] aísla el tamaño de la tabla (ancha a propósito, para el scroll horizontal
    // interno) del cálculo de layout del documento — sin esto, en mobile el navegador terminaba
    // calculando el "viewport" de los elementos position:fixed (el drawer "Nueva reserva" y su
    // fondo) contra el ancho total de la tabla en vez de la pantalla real, dejando el botón "Crear
    // reserva" fuera de alcance detrás del fondo oscuro.
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white [contain:layout]">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-36 min-w-36 border-b border-r border-gray-200 bg-gray-50 p-3 text-left text-xs font-semibold text-gray-500">
              Cancha
            </th>
            {HOURS.map((hour) => (
              <th
                key={hour}
                className="w-[70px] min-w-[70px] border-b border-gray-200 bg-gray-50 px-1 py-3 text-center text-xs font-medium text-gray-500"
              >
                {hour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {venues.map((venue) => {
            const bookingByStart = new Map((bookingsByVenue[venue.id] ?? []).map((b) => [b.startTime, b]));

            return (
              <tr key={venue.id} className="border-b border-gray-100 last:border-b-0">
                <td className="sticky left-0 z-10 border-r border-gray-100 bg-white p-3 align-top">
                  <div className="text-sm font-medium text-gray-900">
                    {VENUE_TYPE_ICON[venue.type] ?? "🏟️"} {venue.name}
                  </div>
                  <div className="text-xs text-gray-500">{VENUE_TYPE_LABEL[venue.type] ?? venue.type}</div>
                  {venue.capacity ? (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                      👤 {venue.capacity}
                    </div>
                  ) : null}
                </td>

                {HOURS.map((hour) => {
                  const booking = bookingByStart.get(hour);

                  // Una reserva PENDIENTE_PAGO ("esperando pago por plataforma") cuenta como
                  // Disponible, no Reservada — mismo criterio que la grilla pública (getDaySlots,
                  // lib/booking/availability.ts): mientras alguien está a mitad de pago, la hora se
                  // sigue viendo libre. La protección real contra doble reserva es el índice único
                  // de blockingSlotKey al crear, no lo que se muestra acá.
                  if (!booking || booking.status === "PENDIENTE_PAGO") {
                    // Cancha combinada (Venue.linkedVenueIds) bloqueada porque su(s) cancha(s) física(s)
                    // ya están reservadas por otra cancha del combo — no es un "+Libre" real.
                    const blocked = blockedByComboByVenue[venue.id]?.[hour];
                    if (blocked) {
                      return (
                        <td key={hour} className="p-1 align-middle">
                          <div
                            title={`Bloqueada — ${blocked.venueName} reservada a esta hora (cancha combinada)`}
                            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border
                              border-gray-200 bg-gray-100 text-gray-400"
                          >
                            <span aria-hidden="true" className="text-sm leading-none">
                              🔒
                            </span>
                            <span className="text-[10px] leading-none">Combinada</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={hour} className="p-1 align-middle">
                        <button
                          type="button"
                          onClick={() => openDrawer(venue.id, hour)}
                          className="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-gray-200 text-gray-400 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <span className="text-sm leading-none">+</span>
                          <span className="text-[11px] leading-none">Libre</span>
                        </button>
                      </td>
                    );
                  }

                  // Reservada: PAGADA/ABONADA/SIN_PAGOS (getPaymentState) para lo que sigue activo;
                  // CANCELADA/NO_SHOW/EXPIRADA no entran en el modelo de pago (getPaymentState
                  // devuelve null) y se siguen mostrando con su propio color de siempre.
                  const paymentState = getPaymentState(booking);
                  const blockStyle = paymentState
                    ? PAYMENT_STATE_BLOCK_STYLE[paymentState]
                    : (STATUS_BLOCK_STYLE[booking.status] ?? STATUS_BLOCK_STYLE.PENDIENTE_PAGO);
                  const icon = paymentState ? PAYMENT_STATE_ICON[paymentState] : (STATUS_ICON[booking.status] ?? "");

                  return (
                    <td key={hour} className="p-1 align-middle">
                      <button
                        type="button"
                        title={`${booking.startTime}-${booking.endTime} · ${booking.customerName || "Sin nombre"}`}
                        onClick={() =>
                          viewReserva({
                            id: booking.id,
                            venueName: venue.name,
                            venueType: venue.type,
                            dateIso,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            customerName: booking.customerName,
                            customerPhone: booking.customerPhone,
                            status: booking.status,
                            totalAmount: booking.totalAmount,
                            depositAmount: booking.depositAmount,
                            recurringBookingId: booking.recurringBookingId,
                            receiptUrl: booking.receiptUrl,
                          })
                        }
                        className={`flex h-14 w-full flex-col items-center justify-center gap-0 rounded-md border text-[11px] leading-tight ${blockStyle}`}
                      >
                        <span className="font-medium">{booking.startTime}</span>
                        <span>-</span>
                        <span className="font-medium">{booking.endTime}</span>
                        {booking.recurringBookingId && <span aria-hidden="true">🔁</span>}
                        <span className="sr-only">{icon}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
