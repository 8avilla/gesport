"use server";

import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db, isUniqueConstraintError } from "@/lib/db";
import { uploadReceipt as uploadReceiptToBlob } from "@/lib/storage/azure";
import { businessDayStart } from "@/lib/time/business-day";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { buildCheckoutPayload, isBoldConfigured, type BoldCheckoutPayload } from "@/lib/payments/bold";
import { BookingStatus, PaymentMethod, computeBlockingSlotKey, isContactComplete } from "./state-machine";

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

  const venue = await db.venue.findUnique({ where: { id: data.venueId } });
  if (!venue || venue.orgId !== org.id || !venue.active) {
    notFound();
  }

  const dateObj = businessDayStart(data.date);
  const blockingSlotKey = computeBlockingSlotKey(venue.id, dateObj, data.startTime);
  const depositAmount = Math.round((venue.hourlyRate * org.depositPercentage) / 100);
  const expiresAt = new Date(Date.now() + org.bookingHoldMinutes * 60_000);

  let bookingId: string;
  try {
    const booking = await db.booking.create({
      data: {
        orgId: org.id,
        venueId: venue.id,
        customerName: "",
        customerPhone: "",
        date: dateObj,
        startTime: data.startTime,
        endTime: data.endTime,
        status: BookingStatus.PENDIENTE_PAGO,
        blockingSlotKey,
        totalAmount: venue.hourlyRate,
        depositAmount,
        expiresAt,
      },
    });
    bookingId = booking.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "cupo_no_disponible" };
    }
    throw error;
  }

  const boldPayload = isBoldConfigured()
    ? buildCheckoutPayload({
        orderId: bookingId,
        amount: depositAmount,
        description: `Abono reserva ${venue.name} ${data.date}`,
        redirectionUrl: `${await getBaseUrl()}/${org.slug}/reserva/${bookingId}`,
      })
    : null;

  return { ok: true, bookingId, totalAmount: venue.hourlyRate, depositAmount, boldPayload };
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
}
