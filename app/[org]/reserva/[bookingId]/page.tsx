import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { buildCheckoutPayload, isBoldConfigured } from "@/lib/payments/bold";
import { uploadManualReceipt } from "@/lib/booking/actions";
import { BookingStatus } from "@/lib/booking/state-machine";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { SubmitButton } from "@/app/components/SubmitButton";
import { BoldButton } from "@/app/components/BoldButton";
import { VenueSummaryCard } from "@/app/components/VenueSummaryCard";
import { ShareWhatsAppButton } from "@/app/components/ShareWhatsAppButton";
import { QueryToast } from "@/app/components/QueryToast";
import { StatusWatcher } from "./StatusWatcher";

const ERROR_MESSAGES: Record<string, string> = {
  comprobante_requerido: "Debes adjuntar el comprobante de pago.",
  demasiados_intentos: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BOLD: "Bold",
  COMPROBANTE_MANUAL: "Comprobante manual",
};

// Bold exige que `data-redirection-url` sea HTTPS (valida el esquema al renderizar el botón, antes
// de cualquier viaje a sus servidores) — usar http:// en local dispara BTN-001. Si no hay
// NEXT_PUBLIC_SITE_URL configurado, forzamos https:// igual; en localhost eso no será alcanzable de
// verdad tras el pago, pero evita el error de atributo inválido mientras se prueba el resto del flujo.
async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  const headerList = await headers();
  const host = headerList.get("host");
  return `https://${host}`;
}

export default async function ReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; bookingId: string }>;
  searchParams: Promise<{ error?: string; comprobante?: string; "bold-tx-status"?: string }>;
}) {
  const { org: orgSlug, bookingId } = await params;
  const { error, comprobante, "bold-tx-status": boldTxStatus } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.orgId !== organization.id) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: booking.venueId } });
  const dateIso = booking.date.toISOString().slice(0, 10);
  const { weekday, day, month } = formatBusinessDayLabel(dateIso);
  const remainder = booking.totalAmount - booking.depositAmount;
  const showsPaymentStep =
    booking.status === BookingStatus.PENDIENTE_PAGO && !booking.receiptUrl && !boldTxStatus;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-center text-lg font-semibold text-gray-900">Tu reserva</h1>

      <div className="mt-4">
        {venue && (
          <VenueSummaryCard
            venue={venue}
            weekday={weekday}
            day={day}
            month={month}
            startTime={booking.startTime}
            endTime={booking.endTime}
          />
        )}
      </div>

      {error && ERROR_MESSAGES[error] && <QueryToast type="error" message={ERROR_MESSAGES[error]} />}

      {booking.status === BookingStatus.CONFIRMADA && (
        <>
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-4xl">
              ✅
            </span>
            <h2 className="mt-3 text-lg font-semibold text-gray-900">¡Reserva confirmada!</h2>
            <p className="mt-1 text-sm text-gray-500">
              Te esperamos el {weekday} {day} de {month} a las {booking.startTime}.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700">Resumen de pago</h3>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-gray-500">Total reserva (1 hora)</span>
              <span className="text-gray-900">${booking.totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-gray-500">
                Abono pagado{booking.paymentMethod && ` (${PAYMENT_METHOD_LABEL[booking.paymentMethod]})`}
              </span>
              <span className="font-medium text-emerald-700">
                ✓ ${booking.depositAmount.toLocaleString("es-CO")}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-gray-100 pt-1.5 text-sm font-medium">
              <span className="text-gray-700">Saldo a pagar en la cancha</span>
              <span className="text-gray-900">${remainder.toLocaleString("es-CO")}</span>
            </div>
            {booking.boldPaymentRef && (
              <p className="mt-3 text-xs text-gray-400">Referencia de pago: {booking.boldPaymentRef}</p>
            )}
          </div>

          <ShareWhatsAppButton
            message={`¡Reserva confirmada! 🎉\n${venue?.name ?? "Cancha"} — ${weekday} ${day} de ${month} a las ${booking.startTime}.\nOrganizado con ${organization.name}.`}
          />

          <Link
            href={`/${orgSlug}`}
            className="mt-3 block rounded-md border border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver al inicio
          </Link>
        </>
      )}

      {(booking.status === BookingStatus.EXPIRADA || booking.status === BookingStatus.CANCELADA) && (
        <>
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-4xl">✕</span>
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Reserva no vigente</h2>
            <p className="mt-1 text-sm text-gray-500">
              Esta reserva ya no está disponible. Vuelve a intentarlo desde el inicio.
            </p>
          </div>
          <Link
            href={`/${orgSlug}/${booking.venueId}`}
            className="mt-4 block rounded-md bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-emerald-700"
          >
            Elegir otro horario
          </Link>
        </>
      )}

      {booking.status === BookingStatus.PENDIENTE_PAGO && booking.receiptUrl && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <span className="text-xl">⏳</span>
          <p className="text-sm text-blue-900">
            Recibimos tu comprobante y está en verificación. Te confirmaremos por WhatsApp en cuanto
            recepción lo apruebe.
          </p>
        </div>
      )}

      {booking.status === BookingStatus.PENDIENTE_PAGO && !booking.receiptUrl && boldTxStatus && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <span className="animate-pulse text-xl">⏳</span>
          <p className="text-sm text-blue-900">
            Estamos verificando tu pago con Bold. Esto puede tardar unos segundos — no cierres ni
            vuelvas a pagar.
          </p>
        </div>
      )}

      {showsPaymentStep && (
        <div className="mt-6">
          <div className="rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700">Resumen de pago</h2>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-gray-500">Total reserva (1 hora)</span>
              <span className="text-gray-900">${booking.totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-gray-500">Abono</span>
              <span className="text-gray-900">- ${booking.depositAmount.toLocaleString("es-CO")}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-gray-100 pt-1.5 text-sm font-medium">
              <span className="text-gray-700">Saldo restante</span>
              <span className="text-gray-900">${remainder.toLocaleString("es-CO")}</span>
            </div>
            <p className="mt-3 rounded-md bg-blue-50 p-2.5 text-xs text-blue-800">
              Paga solo el abono para confirmar tu reserva. El saldo restante lo pagas en la cancha.
            </p>
          </div>

          <h2 className="mt-6 text-sm font-medium text-gray-700">Método de pago</h2>

          {isBoldConfigured() ? (
            <div className="mt-2">
              <BoldButton
                payload={buildCheckoutPayload({
                  orderId: booking.id,
                  amount: booking.depositAmount,
                  description: `Abono reserva ${venue?.name ?? ""} ${dateIso}`,
                  redirectionUrl: `${await getBaseUrl()}/${orgSlug}/reserva/${booking.id}`,
                })}
              />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-500">
                🔒 Pago 100% seguro con Bold
              </p>
            </div>
          ) : (
            <form
              action={uploadManualReceipt}
              className="mt-2 grid gap-3 rounded-xl border border-gray-200 p-4"
            >
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="orgSlug" value={orgSlug} />
              <p className="text-sm text-gray-600">
                Paga por Nequi/Daviplata y sube aquí el comprobante para que recepción lo verifique.
              </p>
              <input
                type="file"
                name="receipt"
                accept="image/*,application/pdf"
                required
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
              />
              <SubmitButton
                pendingLabel="Subiendo…"
                className="rounded-md bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700"
              >
                Subir comprobante
              </SubmitButton>
            </form>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
            <div>
              <div className="text-lg">🛡️</div>
              Confirmación
              <br />
              inmediata
            </div>
            <div>
              <div className="text-lg">🔒</div>
              Sin cargos
              <br />
              ocultos
            </div>
            <div>
              <div className="text-lg">💬</div>
              Soporte por
              <br />
              WhatsApp
            </div>
          </div>
        </div>
      )}

      {comprobante === "enviado" && <QueryToast type="success" message="Comprobante recibido, gracias." />}

      {booking.status === BookingStatus.PENDIENTE_PAGO && (
        <StatusWatcher orgSlug={orgSlug} bookingId={booking.id} currentStatus={booking.status} />
      )}
    </main>
  );
}
