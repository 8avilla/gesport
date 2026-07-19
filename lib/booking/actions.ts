"use server";

import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db, isUniqueConstraintError } from "@/lib/db";
import { uploadReceipt as uploadReceiptToBlob } from "@/lib/storage/azure";
import { businessDateTimeInstant, businessDayStart, formatBusinessDayLabel } from "@/lib/time/business-day";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buildCheckoutPayload, isBoldConfigured, type BoldCheckoutPayload } from "@/lib/payments/bold";
import { getCustomerSession } from "@/lib/customer-auth/session";
import { NotificationService } from "@/lib/notifications";
import { resolveVenuePrice } from "./pricing";
import { buildSlotLockKeys, getVenueUnitIds, releaseSlotLocks } from "./slot-locks";
import {
  BookingStatus,
  CancelledBy,
  PaymentMethod,
  canTransition,
  computeBlockingSlotKey,
  computeCancellationOutcome,
  computeReleasedSlotKey,
  computeSolicitudSlotKey,
  isContactComplete,
  type CancellationOutcome,
} from "./state-machine";

const createBookingSchema = z.object({
  orgSlug: z.string().min(1),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  const headerList = await headers();
  return `https://${headerList.get("host")}`;
}

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      totalAmount: number;
      depositAmount: number;
      boldPayload: BoldCheckoutPayload | null;
      // false = cancha en modo "Solicitud sin pago" (Venue.requiresPayment) — ReservarForm usa esto
      // para mostrar el botón "Enviar solicitud" en vez de Bold/comprobante. No se puede inferir de
      // boldPayload === null, porque eso también pasa cuando Bold simplemente no está configurado a
      // nivel plataforma (cae a comprobante manual).
      requiresPayment: boolean;
    }
  | { ok: false; error: "cupo_no_disponible" | "demasiados_intentos" };

// Congela el horario y prepara el pago (payload de Bold ya firmado, o null si toca comprobante
// manual) apenas el cliente abre la página de "Confirma tu reserva" — antes de que escriba su
// nombre/teléfono. Así el botón de pago está listo de inmediato, sin un paso de "Continuar" en
// medio. El nombre/teléfono se guardan aparte vía updateBookingContact a medida que el cliente
// escribe (ver ReservarForm).
export async function createBookingShell(input: {
  orgSlug: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    notFound();
  }

  const data = parsed.data;

  const ip = await getClientIp();
  if (!checkRateLimit(`crear-reserva:${ip}`, 10, 10 * 60_000)) {
    return { ok: false, error: "demasiados_intentos" };
  }

  const org = await db.organization.findUnique({ where: { slug: data.orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: data.venueId }, include: { priceRules: true } });
  if (!venue || venue.orgId !== org.id || venue.status !== "ACTIVA") {
    notFound();
  }

  const dateObj = businessDayStart(data.date);
  const blockingSlotKey = computeBlockingSlotKey(venue.id, dateObj, data.startTime);
  const price = resolveVenuePrice(venue, venue.priceRules, data.date, data.startTime);
  const depositAmount = Math.round((price * org.depositPercentage) / 100);
  const expiresAt = new Date(Date.now() + org.bookingHoldMinutes * 60_000);

  const bookingData = {
    orgId: org.id,
    venueId: venue.id,
    customerName: "",
    customerPhone: "",
    date: dateObj,
    startTime: data.startTime,
    endTime: data.endTime,
    status: BookingStatus.PENDIENTE_PAGO,
    blockingSlotKey,
    totalAmount: price,
    depositAmount,
    expiresAt,
  };

  // Reclama la franja física de esta cancha y, si combina con otras (Venue.linkedVenueIds, ej.
  // Fútbol 9 armada sobre 2 de Fútbol 7), también las de esas — siempre dentro de una transacción,
  // nunca solo la reserva sola. Antes esto se saltaba para canchas "atómicas" (sin combinar), lo que
  // dejaba un hueco real: una cancha compuesta que reclama esta franja vía SlotLock nunca chocaba
  // contra el Booking.blockingSlotKey de esta cancha (son índices únicos de colecciones distintas),
  // así que ambas podían reservarse la misma hora sin que ninguna rechazara a la otra.
  const unitIds = getVenueUnitIds(venue);
  const slotLockKeys = buildSlotLockKeys(unitIds, dateObj, data.startTime);

  let bookingId: string;
  try {
    bookingId = await db.$transaction(async (tx) => {
      const booking = await tx.booking.create({ data: bookingData });
      for (const key of slotLockKeys) {
        await tx.slotLock.create({ data: { key, bookingId: booking.id } });
      }
      return booking.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "cupo_no_disponible" };
    }
    throw error;
  }

  const boldPayload =
    venue.requiresPayment && isBoldConfigured()
      ? buildCheckoutPayload({
          orderId: bookingId,
          amount: depositAmount,
          description: `Abono reserva ${venue.name} ${data.date}`,
          redirectionUrl: `${await getBaseUrl()}/${org.slug}/reserva/${bookingId}`,
        })
      : null;

  return { ok: true, bookingId, totalAmount: price, depositAmount, boldPayload, requiresPayment: venue.requiresPayment };
}

const updateContactSchema = z.object({
  bookingId: z.string().min(1),
  customerName: z.string().trim().max(200),
  customerPhone: z.string().trim().max(50),
  customerEmail: z.string().trim().max(200).email().optional().or(z.literal("")),
});

// Autoguardado del nombre/teléfono/email mientras el cliente escribe (ver ReservarForm) — la reserva
// ya existe desde createBookingShell, esto solo la va completando. No bloquea al cliente ni redirige.
export async function updateBookingContact(input: {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}): Promise<{ ok: boolean }> {
  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false };
  }

  const ip = await getClientIp();
  if (!checkRateLimit(`guardar-datos-reserva:${ip}`, 60, 60_000)) {
    return { ok: false };
  }

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || booking.status !== BookingStatus.PENDIENTE_PAGO) {
    return { ok: false };
  }

  const { customerName, customerPhone, customerEmail } = parsed.data;

  await db.booking.update({
    where: { id: booking.id },
    data: { customerName, customerPhone, customerEmail: customerEmail || null },
  });

  // El cliente ("Mis reservas", login por WhatsApp) se crea solo apenas los datos de contacto quedan
  // completos — no antes, para no dejar cuentas a medio llenar con nombre/teléfono vacíos.
  if (isContactComplete(customerName, customerPhone)) {
    await db.customer.upsert({
      where: { phone: customerPhone },
      create: { phone: customerPhone, name: customerName, email: customerEmail || null },
      update: { name: customerName, ...(customerEmail ? { email: customerEmail } : {}) },
    });
  }

  return { ok: true };
}

const uploadReceiptSchema = z.object({
  bookingId: z.string().min(1),
  orgSlug: z.string().min(1),
});

export async function uploadManualReceipt(formData: FormData): Promise<void> {
  const parsed = uploadReceiptSchema.safeParse({
    bookingId: formData.get("bookingId"),
    orgSlug: formData.get("orgSlug"),
  });

  if (!parsed.success) {
    notFound();
  }

  const { bookingId, orgSlug } = parsed.data;

  const ip = await getClientIp();
  if (!checkRateLimit(`subir-comprobante:${ip}`, 10, 10 * 60_000)) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=demasiados_intentos`);
  }

  const file = formData.get("receipt");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=comprobante_requerido`);
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== BookingStatus.PENDIENTE_PAGO) {
    notFound();
  }

  // El cliente ya no debería poder llegar aquí sin datos válidos (el botón queda deshabilitado en
  // el formulario), pero como es una Server Action invocable directamente, se revalida server-side.
  if (!isContactComplete(booking.customerName, booking.customerPhone)) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=datos_incompletos`);
  }

  const receiptUrl = await uploadReceiptToBlob(bookingId, file as File);

  await db.booking.update({
    where: { id: bookingId },
    data: { receiptUrl, paymentMethod: PaymentMethod.COMPROBANTE_MANUAL },
  });

  redirect(`/${orgSlug}/reserva/${bookingId}?comprobante=enviado`);
}

const submitBookingRequestSchema = z.object({
  bookingId: z.string().min(1),
  orgSlug: z.string().min(1),
});

// Paso "Enviar solicitud" para canchas con Venue.requiresPayment=false (mismo patrón que
// uploadManualReceipt, pero sin comprobante). La reserva nace PENDIENTE_PAGO (con blockingSlotKey
// real, igual que cualquier otra) para que createBookingShell no tenga que saber todavía nombre/
// teléfono — este es el momento donde de verdad se libera el cupo real (SOLICITADA nunca bloquea) y
// se avisa al admin. Ver decisión en el plan: marcar SOLICITADA desde createBookingShell mandaría el
// aviso con datos vacíos y cortaría al cliente del formulario a mitad de tipeo (poll de status en
// ReservarForm).
export async function submitBookingRequest(formData: FormData): Promise<void> {
  const parsed = submitBookingRequestSchema.safeParse({
    bookingId: formData.get("bookingId"),
    orgSlug: formData.get("orgSlug"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { bookingId, orgSlug } = parsed.data;

  const ip = await getClientIp();
  if (!checkRateLimit(`enviar-solicitud:${ip}`, 10, 10 * 60_000)) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=demasiados_intentos`);
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== BookingStatus.PENDIENTE_PAGO) {
    notFound();
  }

  if (!isContactComplete(booking.customerName, booking.customerPhone)) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=datos_incompletos`);
  }

  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.SOLICITADA,
      blockingSlotKey: computeSolicitudSlotKey(bookingId),
      depositAmount: 0,
    },
  });
  // El hold PENDIENTE_PAGO sí pudo reclamar SlotLock reales (canchas combinables) — hay que
  // soltarlos, una solicitud no debe bloquear nada.
  await releaseSlotLocks(bookingId);

  await notifyBookingRequestSubmitted(booking);

  redirect(`/${orgSlug}/reserva/${bookingId}`);
}

const cancelByCustomerSchema = z.object({
  orgSlug: z.string().min(1),
  bookingId: z.string().min(1),
});

// Cancelación self-service del cliente (negocio.md §6.2) — antes de esto, cancelar solo lo podía hacer
// un ADMIN desde /admin/reservas; al cliente se le pedía escribir por WhatsApp. Aplica la misma
// política de reembolso (computeCancellationOutcome) que ya existía sin usarse en state-machine.ts.
export async function cancelBookingByCustomer(formData: FormData): Promise<void> {
  const parsed = cancelByCustomerSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    bookingId: formData.get("bookingId"),
  });
  if (!parsed.success) {
    notFound();
  }
  const { orgSlug, bookingId } = parsed.data;

  const ip = await getClientIp();
  if (!checkRateLimit(`cancelar-reserva:${ip}`, 10, 10 * 60_000)) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=demasiados_intentos`);
  }

  const customer = await getCustomerSession();
  if (!customer) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=sesion_requerida`);
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerPhone !== customer.phone) {
    notFound();
  }
  if (!canTransition(booking.status, BookingStatus.CANCELADA)) {
    redirect(`/${orgSlug}/reserva/${bookingId}?error=no_cancelable`);
  }

  const organization = await db.organization.findUnique({ where: { id: booking.orgId } });
  if (!organization) {
    notFound();
  }

  const dateIso = booking.date.toISOString().slice(0, 10);
  const outcome = computeCancellationOutcome(businessDateTimeInstant(dateIso, booking.startTime), new Date(), {
    cancellationWindowHours: organization.cancellationWindowHours,
  });

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELADA,
      blockingSlotKey: computeReleasedSlotKey(booking.id),
      cancelledAt: new Date(),
      cancelledBy: CancelledBy.CUSTOMER,
      cancellationReason: outcome.reason,
    },
  });
  await releaseSlotLocks(booking.id);

  await notifyBookingCancelled(booking, organization, outcome);

  redirect(`/${orgSlug}/reserva/${bookingId}?cancelada=1`);
}

// Llamado desde el webhook de Bold (y, en Fase 2, desde la aprobación manual en el POS de recepción).
export async function confirmBookingPayment(bookingId: string, boldPaymentRef?: string): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== BookingStatus.PENDIENTE_PAGO) {
    return;
  }

  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMADA,
      paymentMethod: boldPaymentRef ? PaymentMethod.BOLD : booking.paymentMethod,
      boldPaymentRef: boldPaymentRef ?? booking.boldPaymentRef,
    },
  });

  await sendBookingConfirmedEmails(booking);
}

// Correo con los datos de la reserva al confirmarse el pago — al cliente (si dejó email, es
// opcional) y en paralelo al admin del complejo (negocio.md: "notificando en paralelo a la
// recepción"). Un fallo de Mailgun no debe tumbar la confirmación del pago, por eso va aislado.
// Exportada para que confirmSolicitud (lib/admin/actions.ts) la reuse al confirmar una solicitud —
// mismo correo de "reserva confirmada", sin duplicar el envío.
export async function sendBookingConfirmedEmails(booking: {
  id: string;
  orgId: string;
  venueId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  depositAmount: number;
}): Promise<void> {
  try {
    const [venue, organization, admin] = await Promise.all([
      db.venue.findUnique({ where: { id: booking.venueId } }),
      db.organization.findUnique({ where: { id: booking.orgId } }),
      db.user.findFirst({ where: { orgId: booking.orgId, role: "ADMIN" } }),
    ]);
    if (!venue || !organization) return;

    const { weekday, day, month } = formatBusinessDayLabel(booking.date.toISOString().slice(0, 10));
    const dateLabel = `${weekday} ${day} de ${month}`;

    await Promise.all([
      booking.customerEmail
        ? NotificationService.sendBookingConfirmationEmail({
            customerEmail: booking.customerEmail,
            customerName: booking.customerName,
            venueName: venue.name,
            orgName: organization.name,
            dateLabel,
            startTime: booking.startTime,
            endTime: booking.endTime,
            totalAmount: booking.totalAmount,
            depositAmount: booking.depositAmount,
          })
        : Promise.resolve(),
      admin
        ? NotificationService.sendNewBookingAlertEmail({
            adminEmail: admin.email,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            venueName: venue.name,
            dateLabel,
            startTime: booking.startTime,
            endTime: booking.endTime,
            totalAmount: booking.totalAmount,
            depositAmount: booking.depositAmount,
          })
        : Promise.resolve(),
    ]);
  } catch (error) {
    console.error("[booking] error enviando correos de confirmación", error);
  }
}

// Aviso al admin de una solicitud sin pago recién enviada (submitBookingRequest arriba) — necesita
// confirmar o rechazar a mano, no es un "reserva confirmada" como sendBookingConfirmedEmails.
// Aislado en try/catch: un fallo de Mailgun no debe tumbar la solicitud, que ya se guardó.
async function notifyBookingRequestSubmitted(booking: {
  id: string;
  orgId: string;
  venueId: string;
  customerName: string;
  customerPhone: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
}): Promise<void> {
  try {
    const [venue, admin] = await Promise.all([
      db.venue.findUnique({ where: { id: booking.venueId } }),
      db.user.findFirst({ where: { orgId: booking.orgId, role: "ADMIN" } }),
    ]);
    if (!venue || !admin) return;

    const { weekday, day, month } = formatBusinessDayLabel(booking.date.toISOString().slice(0, 10));
    const dateLabel = `${weekday} ${day} de ${month}`;
    const confirmUrl = `${await getBaseUrl()}/admin/reservas`;

    await NotificationService.sendNewBookingRequestAlertEmail({
      adminEmail: admin.email,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      venueName: venue.name,
      dateLabel,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmount: booking.totalAmount,
      confirmUrl,
    });
  } catch (error) {
    console.error("[booking] error enviando aviso de solicitud", error);
  }
}

// Aviso de cancelación (WhatsApp stub + correo real al admin) — reusado tanto por
// cancelBookingByCustomer (arriba) como por cancelConfirmedBooking (lib/admin/actions.ts), para no
// duplicar el envío. Aislado en try/catch: un fallo de notificación no debe tumbar la cancelación,
// que ya se aplicó en la base de datos antes de llamar a esta función.
export async function notifyBookingCancelled(
  booking: {
    id: string;
    orgId: string;
    venueId: string;
    customerName: string;
    customerPhone: string;
    date: Date;
    startTime: string;
    endTime: string;
  },
  organization: { name: string },
  outcome: CancellationOutcome,
): Promise<void> {
  try {
    const [venue, admin] = await Promise.all([
      db.venue.findUnique({ where: { id: booking.venueId } }),
      db.user.findFirst({ where: { orgId: booking.orgId, role: "ADMIN" } }),
    ]);
    if (!venue) return;

    const { weekday, day, month } = formatBusinessDayLabel(booking.date.toISOString().slice(0, 10));
    const dateLabel = `${weekday} ${day} de ${month}`;

    await Promise.all([
      NotificationService.sendBookingCancellation({
        customerPhone: booking.customerPhone,
        customerName: booking.customerName,
        venueName: venue.name,
        date: dateLabel,
        startTime: booking.startTime,
        refundable: outcome.refundable,
      }),
      admin
        ? NotificationService.sendBookingCancelledAlertEmail({
            adminEmail: admin.email,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            venueName: venue.name,
            dateLabel,
            startTime: booking.startTime,
            endTime: booking.endTime,
            refundable: outcome.refundable,
          })
        : Promise.resolve(),
    ]);
  } catch (error) {
    console.error("[booking] error enviando notificaciones de cancelación", error);
  }
}
