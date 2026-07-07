"use client";

import { useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import { markGroupInCourt, approveManualReceipt, rejectManualReceipt } from "@/lib/pos/actions";
import { BookingStatus } from "@/lib/booking/state-machine";
import { SwipeableRow } from "./SwipeableRow";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
};

export interface PosBooking {
  id: string;
  status: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  receiptUrl: string | null;
  venueName: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Deslizar a la derecha aprueba, a la izquierda rechaza — envía el <form> real (server action) por
// detrás, así la lógica de aprobación/rechazo sigue viviendo en un solo lugar (lib/pos/actions.ts).
function ReceiptActions({
  orgSlug,
  bookingId,
  receiptUrl,
}: {
  orgSlug: string;
  bookingId: string;
  receiptUrl: string;
}) {
  const approveFormRef = useRef<HTMLFormElement>(null);
  const rejectFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="mt-3">
      <SwipeableRow
        rightLabel="✓ Aprobar"
        leftLabel="✕ Rechazar"
        onSwipeRight={() => approveFormRef.current?.requestSubmit()}
        onSwipeLeft={() => rejectFormRef.current?.requestSubmit()}
      >
        <div className="flex items-center gap-2 bg-white py-1">
          <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
            Ver comprobante
          </a>
          <form ref={approveFormRef} action={approveManualReceipt}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="bookingId" value={bookingId} />
            <button type="submit" className="rounded-md bg-green-600 px-3 py-2.5 text-sm text-white">
              Aprobar
            </button>
          </form>
          <form ref={rejectFormRef} action={rejectManualReceipt}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="bookingId" value={bookingId} />
            <button type="submit" className="rounded-md bg-red-600 px-3 py-2.5 text-sm text-white">
              Rechazar
            </button>
          </form>
        </div>
      </SwipeableRow>
      <p className="mt-1 text-center text-xs text-gray-400">← desliza para rechazar · desliza para aprobar →</p>
    </div>
  );
}

// Sincronización en vivo (Fase 5): si dos recepcionistas atienden al tiempo, ambas pantallas se
// actualizan solas cada pocos segundos en vez de requerir un refresh manual.
export function BookingsList({ orgSlug, initialBookings }: { orgSlug: string; initialBookings: PosBooking[] }) {
  const { data } = useSWR<{ bookings: PosBooking[] }>(`/api/${orgSlug}/pos/bookings-today`, fetcher, {
    fallbackData: { bookings: initialBookings },
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const bookings = data?.bookings ?? initialBookings;

  return (
    <ul className="mt-6 grid gap-3">
      {bookings.map((booking) => (
        <li key={booking.id} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {booking.venueName} — {booking.startTime}
            </span>
            <span className="text-xs text-gray-500">{STATUS_LABEL[booking.status] ?? booking.status}</span>
          </div>
          <div className="text-sm text-gray-500">
            {booking.customerName} · {booking.customerPhone}
          </div>

          {booking.status === BookingStatus.PENDIENTE_PAGO && booking.receiptUrl && (
            <ReceiptActions orgSlug={orgSlug} bookingId={booking.id} receiptUrl={booking.receiptUrl} />
          )}

          {booking.status === BookingStatus.CONFIRMADA && (
            <form action={markGroupInCourt} className="mt-3">
              <input type="hidden" name="orgSlug" value={orgSlug} />
              <input type="hidden" name="bookingId" value={booking.id} />
              <button type="submit" className="rounded-md bg-gray-900 px-3 py-2.5 text-sm text-white">
                Marcar grupo en cancha
              </button>
            </form>
          )}

          {booking.status === BookingStatus.EN_CURSO && (
            <Link
              href={`/${orgSlug}/pos/reservas/${booking.id}`}
              className="mt-3 inline-block rounded-md bg-blue-600 px-3 py-2.5 text-sm text-white"
            >
              Ver cuenta
            </Link>
          )}
        </li>
      ))}

      {bookings.length === 0 && <li className="text-sm text-gray-500">Sin reservas para hoy.</li>}
    </ul>
  );
}
