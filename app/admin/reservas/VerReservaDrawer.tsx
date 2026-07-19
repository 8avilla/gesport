"use client";

import { useRef } from "react";
import { cancelConfirmedBooking, confirmSolicitud, registerBookingPayment } from "@/lib/admin/actions";
import { getPaymentState, PAYMENT_STATE_BADGE_STYLE, PAYMENT_STATE_LABEL, STATUS_BADGE_STYLE, STATUS_LABEL } from "@/lib/booking/status-display";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { SubmitButton } from "@/app/components/SubmitButton";

export interface ViewBookingInfo {
  id: string;
  venueName: string;
  venueType: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalAmount: number;
  depositAmount: number;
  recurringBookingId: string | null;
  receiptUrl: string | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

// Detalle de solo lectura de una reserva ya hecha, al hacer clic en su bloque en la agenda
// (AgendaGrid.tsx) — la reserva ya viene completa desde getAgendaBookings, sin ida al servidor.
// CANCELADA/NO_SHOW/EXPIRADA no entran en el modelo de estado de pago (getPaymentState devuelve
// null) — se cae al STATUS_LABEL/STATUS_BADGE_STYLE de siempre, mismo criterio del resto del admin.
export function VerReservaDrawer({ booking, onClose }: { booking: ViewBookingInfo; onClose: () => void }) {
  const paymentState = getPaymentState(booking);
  const paymentLabel = paymentState ? PAYMENT_STATE_LABEL[paymentState] : (STATUS_LABEL[booking.status] ?? booking.status);
  const paymentBadgeStyle = paymentState
    ? PAYMENT_STATE_BADGE_STYLE[paymentState]
    : (STATUS_BADGE_STYLE[booking.status] ?? "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200");

  const formRef = useRef<HTMLFormElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const remaining = booking.totalAmount - booking.depositAmount;
  const isActive = booking.status === "CONFIRMADA" || booking.status === "EN_CURSO";
  const canRegisterPayment = isActive && remaining > 0;

  // "Pagar el total" reusa el mismo <form> (mismo comprobante adjunto, si el admin subió uno) que
  // "Abonar" — solo fuerza el monto al saldo pendiente justo antes de enviar. Input sin controlar a
  // propósito (ref, no useState) para poder escribirle el valor de forma síncrona sin esperar un
  // re-render.
  function handlePagarTotal() {
    if (amountInputRef.current) amountInputRef.current.value = String(remaining);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="fixed inset-0 z-40 bg-black/40" />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Detalle de la reserva</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${paymentBadgeStyle}`}>
            {paymentLabel}
            {booking.recurringBookingId && " · 🔁 Recurrente"}
          </span>

          <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100 px-4">
            <Row
              label="Cancha"
              value={
                <>
                  {VENUE_TYPE_ICON[booking.venueType] ?? "🏟️"} {booking.venueName}
                  <div className="text-xs font-normal text-gray-500">{VENUE_TYPE_LABEL[booking.venueType] ?? booking.venueType}</div>
                </>
              }
            />
            <Row label="Fecha" value={booking.dateIso} />
            <Row label="Horario" value={`${booking.startTime} - ${booking.endTime}`} />
            <Row label="Cliente" value={booking.customerName || "Sin nombre"} />
            <Row label="Teléfono" value={booking.customerPhone || "—"} />
            <Row label="Precio" value={`$${booking.totalAmount.toLocaleString("es-CO")}`} />
            <Row label="Abono recibido" value={`$${booking.depositAmount.toLocaleString("es-CO")}`} />
            {booking.receiptUrl && (
              <Row
                label="Soporte de pago"
                value={
                  <a href={booking.receiptUrl} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                    Ver comprobante
                  </a>
                }
              />
            )}
          </div>

          {canRegisterPayment && (
            <div className="mt-5 rounded-lg border border-gray-100 p-4">
              <p className="text-sm font-medium text-gray-900">Registrar pago</p>
              <p className="mt-0.5 text-xs text-gray-500">Saldo pendiente: ${remaining.toLocaleString("es-CO")}</p>

              <form ref={formRef} action={registerBookingPayment} className="mt-3">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="fecha" value={booking.dateIso} />

                <div className="flex items-end gap-2">
                  <label className="flex-1 text-xs text-gray-500">
                    Monto a abonar
                    <input
                      ref={amountInputRef}
                      type="number"
                      name="amount"
                      min={1}
                      max={remaining}
                      step={1}
                      defaultValue=""
                      placeholder="0"
                      className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900"
                    />
                  </label>
                  <SubmitButton
                    pendingLabel="Abonando…"
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abonar
                  </SubmitButton>
                </div>

                <label className="mt-3 block text-xs text-gray-500">
                  Soporte de pago (opcional)
                  <input
                    type="file"
                    name="receipt"
                    accept="image/*,application/pdf"
                    className="mt-1 w-full text-xs text-gray-600 file:mr-2 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-gray-700"
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePagarTotal}
                  className="mt-3 w-full rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Pagar el total (${remaining.toLocaleString("es-CO")})
                </button>
              </form>
            </div>
          )}

          {booking.status === "CONFIRMADA" && (
            <form action={cancelConfirmedBooking} className="mt-5">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="vista" value="agenda" />
              <input type="hidden" name="fecha" value={booking.dateIso} />
              <SubmitButton
                confirmMessage="¿Cancelar esta reserva confirmada?"
                pendingLabel="Cancelando…"
                className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Cancelar reserva
              </SubmitButton>
            </form>
          )}

          {booking.status === "SOLICITADA" && (
            <div className="mt-5 grid gap-2">
              <p className="text-xs text-gray-500">
                Solicitud sin pago — no está apartada todavía. Confírmala para reclamar el horario.
              </p>
              <form action={confirmSolicitud}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="vista" value="agenda" />
                <input type="hidden" name="fecha" value={booking.dateIso} />
                <SubmitButton
                  pendingLabel="Confirmando…"
                  className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  ✅ Confirmar solicitud
                </SubmitButton>
              </form>
              <form action={cancelConfirmedBooking}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="vista" value="agenda" />
                <input type="hidden" name="fecha" value={booking.dateIso} />
                <SubmitButton
                  confirmMessage="¿Rechazar esta solicitud?"
                  pendingLabel="Rechazando…"
                  className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Rechazar solicitud
                </SubmitButton>
              </form>
            </div>
          )}

          <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm text-gray-500 hover:underline">
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}
