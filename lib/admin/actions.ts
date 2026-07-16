"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ADMIN_ORG_COOKIE, requireAdminSession } from "@/lib/auth/session-guards";
import { notifyBookingCancelled } from "@/lib/booking/actions";
import { OPENING_HOUR, CLOSING_HOUR } from "@/lib/booking/availability";
import { DAY_OF_WEEK_LABEL, resolveVenuePrice, rulesOverlap } from "@/lib/booking/pricing";
import { buildWeeklyOccurrenceDates, MAX_RECURRING_OCCURRENCES } from "@/lib/booking/recurrence";
import { buildSlotLockKeys, getVenueUnitIds, releaseSlotLocks } from "@/lib/booking/slot-locks";
import {
  BookingStatus,
  CancelledBy,
  canTransition,
  computeBlockingSlotKey,
  computeCancellationOutcome,
  computeReleasedSlotKey,
  isValidCustomerName,
  isValidCustomerPhone,
} from "@/lib/booking/state-machine";
import { isValidMunicipio } from "@/lib/data/colombia";
import { db, isUniqueConstraintError } from "@/lib/db";
import { uploadOrganizationLogo, uploadReceipt, uploadVenuePhoto } from "@/lib/storage/azure";
import { businessDateTimeInstant, businessDayStart } from "@/lib/time/business-day";
import { logAdminAction } from "./audit";

// Resuelve el orgId real a partir del slug de la URL en vez de confiar en session.user.orgId — ese
// campo es undefined para SUPERADMIN (no pertenece a ninguna organización, pero sí puede operar
// sobre cualquiera vía requireAdminSession).
async function resolveOrgId(orgSlug: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } });
  if (!org) {
    notFound();
  }
  return org.id;
}

const createVenueSchema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(["FUTBOL_5", "FUTBOL_7", "FUTBOL_8", "FUTBOL_9", "PADEL"]),
  hourlyRate: z.coerce.number().int().min(0),
});

export async function createVenue(formData: FormData): Promise<void> {
  const parsed = createVenueSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      type: parsed.data.type,
      hourlyRate: parsed.data.hourlyRate,
    },
  });

  redirect(`/admin/canchas?creada=${venue.id}`);
}

const MAX_VENUE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_VENUE_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_VENUE_PHOTOS = 8;

const updateVenueSchema = z.object({
  venueId: z.string().min(1),
  // Opcionales con fallback al valor actual de la cancha (ver más abajo): así un form que solo edita
  // fotos, por ejemplo, no necesita repetir todos los campos para no perderlos.
  name: z.string().trim().min(2).optional(),
  type: z.enum(["FUTBOL_5", "FUTBOL_7", "FUTBOL_8", "FUTBOL_9", "PADEL"]).optional(),
  hourlyRate: z.coerce.number().int().min(0),
  // El orden importa: Number("") es 0 (no NaN), así que si coerce.number() fuera la primera rama,
  // un campo vacío se guardaría como capacity=0 en vez de quedar sin definir.
  capacity: z.literal("").transform(() => undefined).or(z.coerce.number().int().min(0)),
  status: z.enum(["ACTIVA", "MANTENIMIENTO", "INACTIVA"]),
  linkedVenueIds: z.array(z.string()).default([]),
  surface: z.string().trim().optional(),
  coverage: z.string().trim().optional(),
  locationInComplex: z.string().trim().optional(),
  description: z.string().trim().optional(),
  amenities: z.array(z.string()).default([]),
});

// Fotos: input de archivo real (Azure Blob, mismo patrón que uploadOrganizationLogo) en vez del
// textarea de URLs anterior — el admin no siempre tiene dónde hostear una foto para pegar el link.
// Las existentes se muestran como miniaturas con checkbox "Eliminar" (removePhotos); las nuevas se
// suben acá mismo y se agregan al arreglo.
export async function updateVenue(formData: FormData): Promise<void> {
  const parsed = updateVenueSchema.safeParse({
    venueId: formData.get("venueId"),
    name: formData.get("name") || undefined,
    type: formData.get("type") || undefined,
    hourlyRate: formData.get("hourlyRate"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
    linkedVenueIds: formData.getAll("linkedVenueIds"),
    surface: formData.get("surface") ?? undefined,
    coverage: formData.get("coverage") ?? undefined,
    locationInComplex: formData.get("locationInComplex") ?? undefined,
    description: formData.get("description") ?? undefined,
    amenities: formData.getAll("amenities"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const { venueId } = parsed.data;
  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    notFound();
  }

  // Solo se permite combinar con otras canchas de la MISMA organización (nunca consigo misma) —
  // valida el formulario contra manipulación (ver Venue.linkedVenueIds, canchas combinables).
  const validSiblingIds = new Set(
    (
      await db.venue.findMany({
        where: { orgId: venue.orgId, id: { in: parsed.data.linkedVenueIds, not: venueId } },
        select: { id: true },
      })
    ).map((v) => v.id),
  );
  const linkedVenueIds = parsed.data.linkedVenueIds.filter((id) => validSiblingIds.has(id));

  const removePhotos = new Set(formData.getAll("removePhotos").map(String));
  const keptPhotos = venue.imageUrls.filter((url) => !removePhotos.has(url));

  const newFiles = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (keptPhotos.length + newFiles.length > MAX_VENUE_PHOTOS) {
    redirect(`/admin/canchas/${venueId}?error=demasiadas_fotos`);
  }

  for (const file of newFiles) {
    if (!ALLOWED_VENUE_PHOTO_TYPES.includes(file.type)) {
      redirect(`/admin/canchas/${venueId}?error=foto_formato_invalido`);
    }
    if (file.size > MAX_VENUE_PHOTO_SIZE_BYTES) {
      redirect(`/admin/canchas/${venueId}?error=foto_muy_grande`);
    }
  }

  const uploadedUrls = await Promise.all(newFiles.map((file) => uploadVenuePhoto(venueId, file)));

  if (parsed.data.hourlyRate !== venue.hourlyRate) {
    await logAdminAction({
      orgId: venue.orgId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      action: "venue.updatePrice",
      summary: `Cambió tarifa de ${venue.name} de $${venue.hourlyRate.toLocaleString("es-CO")} a $${parsed.data.hourlyRate.toLocaleString("es-CO")}`,
    });
  }

  await db.venue.update({
    where: { id: venueId },
    data: {
      name: parsed.data.name || venue.name,
      type: parsed.data.type || venue.type,
      hourlyRate: parsed.data.hourlyRate,
      imageUrls: [...keptPhotos, ...uploadedUrls],
      capacity: parsed.data.capacity ?? null,
      status: parsed.data.status,
      linkedVenueIds,
      surface: parsed.data.surface || null,
      coverage: parsed.data.coverage || null,
      locationInComplex: parsed.data.locationInComplex || null,
      description: parsed.data.description || null,
      amenities: parsed.data.amenities,
    },
  });

  redirect(`/admin/canchas/${venueId}?actualizado=1`);
}

const setVenueStatusSchema = z.object({
  venueId: z.string().min(1),
  status: z.enum(["ACTIVA", "MANTENIMIENTO", "INACTIVA"]),
});

// Atajo del dropdown "Más acciones" en la página de detalle — cambia solo el estado, sin pasar por
// el form completo de edición (que exige tarifa/capacidad/etc.).
export async function setVenueStatus(formData: FormData): Promise<void> {
  const parsed = setVenueStatusSchema.safeParse({
    venueId: formData.get("venueId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const venue = await db.venue.findUnique({ where: { id: parsed.data.venueId } });
  if (!venue) {
    notFound();
  }

  await db.venue.update({ where: { id: venue.id }, data: { status: parsed.data.status } });

  const STATUS_LABEL: Record<string, string> = { ACTIVA: "Activa", MANTENIMIENTO: "Mantenimiento", INACTIVA: "Inactiva" };
  await logAdminAction({
    orgId: venue.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "venue.setStatus",
    summary: `Cambió estado de ${venue.name} de ${STATUS_LABEL[venue.status]} a ${STATUS_LABEL[parsed.data.status]}`,
  });

  redirect(`/admin/canchas/${venue.id}?actualizado=1`);
}

const createPriceRuleSchema = z.object({
  venueId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:00$/),
  endTime: z.string().regex(/^\d{2}:00$/),
  price: z.coerce.number().int().min(0),
});

// Excepción de precio para la pestaña "Precios" de la página de detalle (día + rango horario +
// precio). Sin solape permitido con otra excepción de la misma cancha/día — el guardado se rechaza
// en vez de definir una regla de desempate (ver rulesOverlap, lib/booking/pricing.ts).
export async function createVenuePriceRule(formData: FormData): Promise<void> {
  const parsed = createPriceRuleSchema.safeParse({
    venueId: formData.get("venueId"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    price: formData.get("price"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const { venueId, dayOfWeek, startTime, endTime, price } = parsed.data;

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== org.id) {
    notFound();
  }

  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  if (endTime <= startTime || startHour < OPENING_HOUR || endHour > CLOSING_HOUR) {
    redirect(`/admin/canchas/${venueId}?tab=precios&error=precio_rango_invalido`);
  }

  const existingRules = await db.venuePriceRule.findMany({ where: { venueId, dayOfWeek } });
  if (existingRules.some((rule) => rulesOverlap(rule, { dayOfWeek, startTime, endTime }))) {
    redirect(`/admin/canchas/${venueId}?tab=precios&error=precio_solapado`);
  }

  await db.venuePriceRule.create({ data: { venueId, dayOfWeek, startTime, endTime, price } });

  await logAdminAction({
    orgId: venue.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "venue.addPriceRule",
    summary: `Agregó excepción de precio a ${venue.name}: ${DAY_OF_WEEK_LABEL[dayOfWeek]} ${startTime}-${endTime} → $${price.toLocaleString("es-CO")}`,
  });

  redirect(`/admin/canchas/${venueId}?tab=precios&actualizado=1`);
}

// deleteMany en vez de "buscar, verificar dueño, borrar" — el filtro { id, venueId } ya hace de
// verificación de pertenencia en una sola operación atómica, sin condición de carrera entre pasos.
export async function deleteVenuePriceRule(formData: FormData): Promise<void> {
  const venueId = String(formData.get("venueId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  if (!venueId || !ruleId) {
    notFound();
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== org.id) {
    notFound();
  }

  const { count } = await db.venuePriceRule.deleteMany({ where: { id: ruleId, venueId } });
  if (count > 0) {
    await logAdminAction({
      orgId: venue.orgId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      action: "venue.removePriceRule",
      summary: `Eliminó una excepción de precio de ${venue.name}`,
    });
  }

  redirect(`/admin/canchas/${venueId}?tab=precios&actualizado=1`);
}

const createProductSchema = z.object({
  name: z.string().trim().min(2),
  price: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
});

export async function createProduct(formData: FormData): Promise<void> {
  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const product = await db.consumptionItem.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      price: parsed.data.price,
      stock: parsed.data.stock,
      lowStockThreshold: parsed.data.lowStockThreshold,
    },
  });

  redirect(`/admin/inventario?creado=${product.id}`);
}

const updateProductSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
  active: z.enum(["true", "false"]),
});

export async function updateProduct(formData: FormData): Promise<void> {
  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    price: formData.get("price"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireAdminSession();

  await db.consumptionItem.update({
    where: { id: parsed.data.productId },
    data: {
      price: parsed.data.price,
      lowStockThreshold: parsed.data.lowStockThreshold,
      active: parsed.data.active === "true",
    },
  });

  redirect(`/admin/inventario?actualizado=${parsed.data.productId}`);
}

const adjustStockSchema = z.object({
  productId: z.string().min(1),
  delta: z.coerce.number().int(),
});

// Entrada (o corrección) de almacén — negocio.md §6.4: "Ajustar inventario" es exclusivo de ADMIN.
export async function adjustStock(formData: FormData): Promise<void> {
  const parsed = adjustStockSchema.safeParse({
    productId: formData.get("productId"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const product = await db.consumptionItem.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    notFound();
  }

  const newStock = Math.max(0, product.stock + parsed.data.delta);

  await db.consumptionItem.update({
    where: { id: product.id },
    data: { stock: newStock },
  });

  await logAdminAction({
    orgId: product.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "product.adjustStock",
    summary: `Ajustó stock de ${product.name}: ${product.stock} → ${newStock} (${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta})`,
  });

  redirect(`/admin/inventario?actualizado=${product.id}`);
}

const settingsSchema = z.object({
  depositPercentage: z.coerce.number().int().min(1).max(100),
  cancellationWindowHours: z.coerce.number().int().min(0),
  bookingHoldMinutes: z.coerce.number().int().min(1),
});

export async function updateOrganizationSettings(formData: FormData): Promise<void> {
  const parsed = settingsSchema.safeParse({
    depositPercentage: formData.get("depositPercentage"),
    cancellationWindowHours: formData.get("cancellationWindowHours"),
    bookingHoldMinutes: formData.get("bookingHoldMinutes"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  await db.organization.update({
    where: { slug: orgSlug },
    data: {
      depositPercentage: parsed.data.depositPercentage,
      cancellationWindowHours: parsed.data.cancellationWindowHours,
      bookingHoldMinutes: parsed.data.bookingHoldMinutes,
    },
  });

  redirect("/admin/configuracion?tab=horarios&settings=actualizado");
}

const infoSchema = z.object({
  name: z.string().trim().min(2).max(200),
  address: z.string().trim().min(1).max(300),
  phone: z.string().trim().max(50).optional(),
  contactEmail: z.string().trim().email(),
  website: z.string().trim().max(200).optional(),
  description: z.string().trim().max(300).optional(),
  department: z.string().min(1),
  municipality: z.string().min(1),
  // Punto exacto del complejo en el mapa (LocationMapPicker) — separado de departamento/municipio,
  // que solo describen la región. Sin esto no hay pin que mostrar en el buscador principal.
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

// Datos de identidad y ubicación del complejo (tab "Información general", una sola card visual):
// separado de updateOrganizationSlug y updateOrganizationLogo porque esos dos tienen su propia
// validación/consecuencias (URLs públicas, upload de archivo) y conviene poder guardarlos
// independientemente de este formulario.
export async function updateOrganizationInfo(formData: FormData): Promise<void> {
  const parsed = infoSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone") || undefined,
    contactEmail: formData.get("contactEmail"),
    website: formData.get("website") || undefined,
    description: formData.get("description") || undefined,
    department: formData.get("department"),
    municipality: formData.get("municipality"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    redirect("/admin/configuracion?tab=general&error=datos_invalidos");
  }

  const { orgSlug } = await requireAdminSession();

  if (!isValidMunicipio(parsed.data.department, parsed.data.municipality)) {
    redirect("/admin/configuracion?tab=general&error=ubicacion_invalida");
  }

  await db.organization.update({
    where: { slug: orgSlug },
    data: {
      name: parsed.data.name,
      address: parsed.data.address,
      phone: parsed.data.phone || null,
      contactEmail: parsed.data.contactEmail,
      website: parsed.data.website || null,
      description: parsed.data.description || null,
      department: parsed.data.department,
      municipality: parsed.data.municipality,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    },
  });

  redirect("/admin/configuracion?tab=general&info=actualizada");
}

const slugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/),
});

// Cambiar el slug mueve todas las URLs públicas de la organización (/{slug}, /{slug}/pos, etc.) — el
// admin que hace el cambio sigue viendo su propio panel sin re-loguearse porque requireAdminSession
// resuelve el slug fresco desde orgId, no desde la sesión. Para SUPERADMIN (que "entra" vía la cookie
// admin_org_slug) sí hace falta actualizar esa cookie a mano, o quedaría apuntando al slug viejo.
export async function updateOrganizationSlug(formData: FormData): Promise<void> {
  const parsed = slugSchema.safeParse({ slug: formData.get("slug") });
  if (!parsed.success) {
    redirect("/admin/configuracion?tab=seguridad&error=slug_invalido");
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  if (parsed.data.slug === org.slug) {
    redirect("/admin/configuracion?tab=seguridad");
  }

  try {
    await db.organization.update({
      where: { id: org.id },
      data: { slug: parsed.data.slug },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/configuracion?tab=seguridad&error=slug_en_uso");
    }
    throw error;
  }

  if (session.user.role === "SUPERADMIN") {
    (await cookies()).set(ADMIN_ORG_COOKIE, parsed.data.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  redirect("/admin/configuracion?tab=seguridad&slug=actualizado");
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function updateOrganizationLogo(formData: FormData): Promise<void> {
  const { orgSlug } = await requireAdminSession();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/configuracion?tab=general&error=logo_requerido");
  }

  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    redirect("/admin/configuracion?tab=general&error=logo_formato_invalido");
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    redirect("/admin/configuracion?tab=general&error=logo_muy_grande");
  }

  const logoUrl = await uploadOrganizationLogo(orgSlug, file as File);

  await db.organization.update({
    where: { slug: orgSlug },
    data: { logoUrl },
  });

  redirect("/admin/configuracion?tab=general&logo=actualizado");
}

const optionalDateOrEmpty = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""))
  .optional();

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  dateFrom: optionalDateOrEmpty,
  dateTo: optionalDateOrEmpty,
  venueId: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  // Solo presentes cuando se cancela desde la vista agenda (kebab de "Próximas reservas") — para
  // volver al mismo día que se estaba viendo en vez de resetear a la vista lista de "hoy".
  vista: z.string().min(1).optional(),
  fecha: optionalDateOrEmpty,
});

// negocio.md §6.4: "Cancelar reserva confirmada" — el empleado no puede, solo el ADMIN.
export async function cancelConfirmedBooking(formData: FormData): Promise<void> {
  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    dateFrom: formData.get("dateFrom") ?? undefined,
    dateTo: formData.get("dateTo") ?? undefined,
    venueId: formData.get("venueId") ?? undefined,
    type: formData.get("type") ?? undefined,
    status: formData.get("status") ?? undefined,
    name: formData.get("name") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    vista: formData.get("vista") ?? undefined,
    fecha: formData.get("fecha") ?? undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || !canTransition(booking.status, BookingStatus.CANCELADA)) {
    notFound();
  }

  const organization = await db.organization.findUnique({ where: { id: booking.orgId } });
  const venue = await db.venue.findUnique({ where: { id: booking.venueId } });

  // El admin puede cancelar sin importar la ventana de tiempo — computeCancellationOutcome acá solo
  // deja un registro consistente de "hubiera sido reembolsable", nunca bloquea la cancelación.
  const dateIso = booking.date.toISOString().slice(0, 10);
  const outcome = organization
    ? computeCancellationOutcome(businessDateTimeInstant(dateIso, booking.startTime), new Date(), {
        cancellationWindowHours: organization.cancellationWindowHours,
      })
    : { refundable: false as const, reason: "late_cancellation" as const };

  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELADA,
      blockingSlotKey: computeReleasedSlotKey(booking.id),
      cancelledAt: new Date(),
      cancelledBy: CancelledBy.ADMIN,
      cancellationReason: outcome.reason,
    },
  });
  await releaseSlotLocks(booking.id);

  if (organization) {
    await notifyBookingCancelled(booking, organization, outcome);
  }

  await logAdminAction({
    orgId: booking.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.cancel",
    summary: `Canceló la reserva de ${booking.customerName || "cliente sin nombre"} (${venue?.name ?? booking.venueId}) del ${dateIso} ${booking.startTime}`,
  });

  // Vuelve a la lista preservando los filtros que el admin tenía activos (rango de fechas, cancha,
  // tipo, estado) en vez de resetear siempre a "hoy sin filtros". dateFrom/dateTo se preservan
  // aunque vengan vacíos ("" = sin límite en ese extremo) para no perder un "todas las fechas".
  const query = new URLSearchParams();
  if (parsed.data.vista) {
    query.set("vista", parsed.data.vista);
  }
  if (parsed.data.fecha) {
    query.set("fecha", parsed.data.fecha);
  }
  if (parsed.data.dateFrom !== undefined) {
    query.set("dateFrom", parsed.data.dateFrom);
  }
  if (parsed.data.dateTo !== undefined) {
    query.set("dateTo", parsed.data.dateTo);
  }
  if (parsed.data.venueId) {
    query.set("venueId", parsed.data.venueId);
  }
  if (parsed.data.type) {
    query.set("type", parsed.data.type);
  }
  if (parsed.data.status) {
    query.set("status", parsed.data.status);
  }
  if (parsed.data.name) {
    query.set("name", parsed.data.name);
  }
  if (parsed.data.phone) {
    query.set("phone", parsed.data.phone);
  }
  query.set("cancelada", "1");
  redirect(`/admin/reservas?${query.toString()}`);
}

const registerPaymentSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().int().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Abonar (monto parcial) o pagar el total pendiente (VerReservaDrawer.tsx ya manda el saldo exacto
// como `amount`) desde el detalle de una reserva en la agenda — solo aplica a reservas activas
// (CONFIRMADA/EN_CURSO); el abono nunca puede superar el precio, se topa igual que al crear la
// reserva (ver createBooking, misma razón: nunca queda "sobrepagada").
export async function registerBookingPayment(formData: FormData): Promise<void> {
  const parsed = registerPaymentSchema.safeParse({
    bookingId: formData.get("bookingId"),
    amount: formData.get("amount"),
    fecha: formData.get("fecha"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking || (booking.status !== BookingStatus.CONFIRMADA && booking.status !== BookingStatus.EN_CURSO)) {
    notFound();
  }

  const newDepositAmount = Math.min(booking.depositAmount + parsed.data.amount, booking.totalAmount);

  // Soporte de pago opcional en este mismo abono — si se sube uno nuevo, reemplaza el anterior
  // (receiptUrl es un solo campo, no un historial); igual que al crear la reserva, mismo storage.
  const receiptFile = formData.get("receipt");
  const receiptUrl = receiptFile instanceof File && receiptFile.size > 0 ? await uploadReceipt(booking.id, receiptFile) : undefined;

  await db.booking.update({
    where: { id: booking.id },
    data: { depositAmount: newDepositAmount, ...(receiptUrl ? { receiptUrl } : {}) },
  });

  await logAdminAction({
    orgId: booking.orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.registerPayment",
    summary: `Registró un pago de $${parsed.data.amount.toLocaleString("es-CO")} en la reserva de ${booking.customerName || "cliente sin nombre"} (abono ${booking.depositAmount.toLocaleString("es-CO")} → ${newDepositAmount.toLocaleString("es-CO")})`,
  });

  redirect(`/admin/reservas?vista=agenda&fecha=${parsed.data.fecha}&pagoRegistrado=1`);
}

const createRecurringBookingSchema = z.object({
  venueId: z.string().min(1),
  customerName: z.string().trim().min(2).max(200),
  customerPhone: z.string().trim().min(7).max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  // Checkbox HTML: presente ("on") solo si el admin la marcó, ausente si no.
  requiresDeposit: z.literal("on").optional(),
  bookingType: z.enum(["PARTICULAR", "TORNEO", "CLASE"]).optional(),
  notes: z.string().trim().max(500).optional(),
});

// Crea una reserva recurrente semanal (ej. "cliente fijo todos los martes 6pm"): el admin la
// confirma directo, sin paso de pago online — el abono (si aplica) se cobra en persona y el admin
// decide al crear la serie si esta reserva lo requiere o no. Genera de una sola vez todas las
// ocurrencias entre startDate y endDate; si cualquiera choca con un turno ya ocupado, no crea nada
// de la serie (el admin debe resolver el conflicto primero, ver decisión de producto).
export async function createRecurringBooking(formData: FormData): Promise<void> {
  const parsed = createRecurringBookingSchema.safeParse({
    venueId: formData.get("venueId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    requiresDeposit: formData.get("requiresDeposit") ?? undefined,
    bookingType: formData.get("bookingType") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  const {
    venueId,
    customerName,
    customerPhone,
    startDate,
    endDate,
    startTime,
    endTime,
    requiresDeposit,
    bookingType,
    notes,
  } = parsed.data;

  const { session, orgSlug } = await requireAdminSession();

  if (endDate < startDate) {
    redirect("/admin/reservas?error=recurrente_rango_invalido");
  }

  const occurrenceDates = buildWeeklyOccurrenceDates(startDate, endDate);
  if (occurrenceDates.length > MAX_RECURRING_OCCURRENCES) {
    redirect("/admin/reservas?error=recurrente_demasiadas_ocurrencias");
  }

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId }, include: { priceRules: true } });
  if (!venue || venue.orgId !== org.id || venue.status !== "ACTIVA") {
    notFound();
  }

  // Todas las ocurrencias de la serie caen en el mismo día de la semana y usan el mismo startTime
  // fijo (se repite semanalmente) — el precio es idéntico para todas, se resuelve una sola vez.
  const price = resolveVenuePrice(venue, venue.priceRules, startDate, startTime);
  const depositAmount = requiresDeposit ? Math.round((price * org.depositPercentage) / 100) : 0;

  // No depende de la fecha — se calcula una vez fuera del loop de ocurrencias (ver nota en
  // createBookingShell, lib/booking/actions.ts, sobre por qué cada ocurrencia debe reclamar su
  // franja vía SlotLock incluso siendo una cancha atómica, para no dejar un hueco de doble reserva
  // contra otra cancha combinada).
  const unitIds = getVenueUnitIds(venue);

  try {
    await db.$transaction(async (tx) => {
      const series = await tx.recurringBooking.create({
        data: {
          orgId: org.id,
          venueId: venue.id,
          customerName,
          customerPhone,
          startTime,
          endTime,
          startDate: businessDayStart(startDate),
          endDate: businessDayStart(endDate),
          bookingType,
          notes,
        },
      });

      for (const dateIso of occurrenceDates) {
        const dateObj = businessDayStart(dateIso);
        const booking = await tx.booking.create({
          data: {
            orgId: org.id,
            venueId: venue.id,
            recurringBookingId: series.id,
            customerName,
            customerPhone,
            date: dateObj,
            startTime,
            endTime,
            status: BookingStatus.CONFIRMADA,
            blockingSlotKey: computeBlockingSlotKey(venue.id, dateObj, startTime),
            totalAmount: price,
            depositAmount,
            bookingType,
            notes,
          },
        });
        for (const key of buildSlotLockKeys(unitIds, dateObj, startTime)) {
          await tx.slotLock.create({ data: { key, bookingId: booking.id } });
        }
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/reservas?error=recurrente_cupo_no_disponible");
    }
    throw error;
  }

  await logAdminAction({
    orgId: org.id,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.createRecurring",
    summary: `Creó reserva recurrente para ${customerName} en ${venue.name}, ${startTime}-${endTime}, ${occurrenceDates.length} ocurrencias (${startDate} a ${endDate})`,
  });

  redirect(`/admin/reservas?dateFrom=${startDate}&dateTo=${startDate}&recurrente=creada`);
}

const createBookingSchema = z.object({
  venueId: z.string().min(1),
  customerName: z.string().trim().min(2).max(200),
  // El teléfono es opcional acá (a diferencia del flujo de cliente) — el admin puede estar
  // registrando una reserva presencial o telefónica sin ese dato a mano.
  customerPhone: z.string().trim().max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/), // hora en punto — mismo grid de 1h fijo del resto de la app
  // Precio editable por el admin (ej. tarifa especial/descuento) — si lo deja vacío, se usa la
  // tarifa real de la cancha (resolveVenuePrice, con excepciones de precio si aplican).
  totalAmount: z.literal("").transform(() => undefined).or(z.coerce.number().int().min(0)).optional(),
  // Abono recibido, en pesos — el estado de pago (sin pago/abonada/pagada) no se elige a mano, se
  // deriva de este valor comparado contra el precio final (ver más abajo, tras resolver `price`).
  depositAmount: z.literal("").transform(() => 0).or(z.coerce.number().int().min(0)),
  bookingType: z.enum(["PARTICULAR", "TORNEO", "CLASE"]).optional(),
  notes: z.string().trim().max(500).optional(),
});

function slotEndTime(startTime: string): string {
  const hour = Number(startTime.slice(0, 2));
  return `${String(hour + 1).padStart(2, "0")}:00`;
}

// Reserva individual creada por el admin desde el drawer "Nueva reserva" de /admin/reservas —
// equivalente admin de createWalkInBooking (lib/pos/actions.ts), que hoy solo vive en el flujo de
// POS/caja. Duración fija de 1 hora, igual que el resto del sistema (ver decisión de producto:
// ningún flujo de reserva soporta hoy turnos de varias horas sin construir bloqueo multi-hora nuevo).
export async function createBooking(formData: FormData): Promise<void> {
  const parsed = createBookingSchema.safeParse({
    venueId: formData.get("venueId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    totalAmount: formData.get("totalAmount"),
    depositAmount: formData.get("depositAmount"),
    bookingType: formData.get("bookingType") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (
    !parsed.success ||
    !isValidCustomerName(parsed.data.customerName) ||
    (parsed.data.customerPhone && !isValidCustomerPhone(parsed.data.customerPhone))
  ) {
    redirect("/admin/reservas?nueva=1&error=datos_invalidos");
  }

  const {
    venueId,
    customerName,
    customerPhone,
    date,
    startTime,
    totalAmount: totalAmountOverride,
    depositAmount: depositAmountInput,
    bookingType,
    notes,
  } = parsed.data;

  const hour = Number(startTime.slice(0, 2));
  if (hour < OPENING_HOUR || hour >= CLOSING_HOUR) {
    redirect("/admin/reservas?nueva=1&error=datos_invalidos");
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId }, include: { priceRules: true } });
  if (!venue || venue.orgId !== org.id || venue.status !== "ACTIVA") {
    notFound();
  }

  const dateObj = businessDayStart(date);
  const endTime = slotEndTime(startTime);
  const price = totalAmountOverride ?? resolveVenuePrice(venue, venue.priceRules, date, startTime);
  // El abono nunca puede superar el precio final — si el admin escribe un monto mayor (o igual), la
  // reserva simplemente queda pagada por completo, no "sobrepagada".
  const depositAmount = Math.min(depositAmountInput, price);

  const bookingData = {
    orgId: org.id,
    venueId: venue.id,
    customerName,
    customerPhone: customerPhone ?? "",
    date: dateObj,
    startTime,
    endTime,
    // Siempre CONFIRMADA — PENDIENTE_PAGO ("esperando pago por plataforma") es exclusivo del flujo
    // de cliente vía pasarela (Bold); una reserva creada por el admin ya está agendada de una vez,
    // el estado de pago real (sin pago/abonada/pagada) lo indica el abono, no un selector aparte.
    status: BookingStatus.CONFIRMADA,
    blockingSlotKey: computeBlockingSlotKey(venue.id, dateObj, startTime),
    totalAmount: price,
    depositAmount,
    bookingType,
    notes,
  };

  // Reclama la franja física de esta cancha y, si combina con otras (ver Venue.linkedVenueIds y
  // lib/booking/slot-locks.ts), también las de esas — siempre en transacción, sin importar si es
  // atómica o compuesta (ver nota en createBookingShell, lib/booking/actions.ts, sobre por qué
  // saltarse esto para canchas atómicas dejaba un hueco real de doble reserva).
  const unitIds = getVenueUnitIds(venue);
  const slotLockKeys = buildSlotLockKeys(unitIds, dateObj, startTime);

  let createdBookingId: string;
  try {
    createdBookingId = await db.$transaction(async (tx) => {
      const booking = await tx.booking.create({ data: bookingData });
      for (const key of slotLockKeys) {
        await tx.slotLock.create({ data: { key, bookingId: booking.id } });
      }
      return booking.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/reservas?nueva=1&error=cupo_no_disponible");
    }
    throw error;
  }

  // Soporte de pago opcional (comprobante Nequi/Daviplata) — mismo storage y campo receiptUrl que ya
  // usa el flujo público (uploadReceiptToBlob en lib/booking/actions.ts), reutilizado acá para que el
  // admin también pueda dejar constancia del abono al crear la reserva a mano.
  const receiptFile = formData.get("receipt");
  if (receiptFile instanceof File && receiptFile.size > 0) {
    const receiptUrl = await uploadReceipt(createdBookingId, receiptFile);
    await db.booking.update({ where: { id: createdBookingId }, data: { receiptUrl } });
  }

  // El cliente ("Mis reservas", login por WhatsApp) se crea/actualiza solo si hay un teléfono válido
  // — mismo criterio y patrón que updateBookingContact (lib/booking/actions.ts) en el flujo público.
  if (customerPhone && isValidCustomerPhone(customerPhone)) {
    await db.customer.upsert({
      where: { phone: customerPhone },
      create: { phone: customerPhone, name: customerName },
      update: { name: customerName },
    });
  }

  await logAdminAction({
    orgId: org.id,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "booking.create",
    summary: `Creó reserva para ${customerName} en ${venue.name} el ${date} ${startTime}`,
  });

  redirect(`/admin/reservas?fecha=${date}&creada=1`);
}

export interface CustomerSuggestion {
  name: string;
  phone: string;
}

// Autocompletar del campo "Cliente" en el drawer "Nueva reserva" (NuevaReservaDrawer) — se llama
// directo desde el cliente (no es un <form action>), mismo patrón que updateBookingContact en
// lib/booking/actions.ts. Busca entre las reservas ya hechas EN ESTA organización (no en la tabla
// global de Customer, que es cross-org para "Mis reservas") — así solo sugiere clientes que ya
// reservaron acá, sin filtrar por otras organizaciones.
export async function searchCustomers(query: string): Promise<CustomerSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const { orgSlug } = await requireAdminSession();
  const org = await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } });
  if (!org) {
    return [];
  }

  const bookings = await db.booking.findMany({
    where: { orgId: org.id, customerName: { contains: trimmed, mode: "insensitive" }, customerPhone: { not: "" } },
    select: { customerName: true, customerPhone: true },
    orderBy: { createdAt: "desc" },
    take: 50, // margen para poder deduplicar por teléfono y aun así llegar a varias sugerencias
  });

  const seenPhones = new Set<string>();
  const suggestions: CustomerSuggestion[] = [];
  for (const booking of bookings) {
    if (seenPhones.has(booking.customerPhone)) continue;
    seenPhones.add(booking.customerPhone);
    suggestions.push({ name: booking.customerName, phone: booking.customerPhone });
    if (suggestions.length >= 6) break;
  }

  return suggestions;
}

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
});

export async function createUser(formData: FormData): Promise<void> {
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect("/admin/usuarios?error=datos_invalidos");
  }

  const { session, orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    redirect("/admin/usuarios?error=email_en_uso");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await db.user.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
  });

  await logAdminAction({
    orgId: org.id,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "user.create",
    summary: `Creó el usuario ${parsed.data.name} (${parsed.data.email}) como ${parsed.data.role}`,
  });

  redirect("/admin/usuarios?ok=usuario_creado");
}

const updateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  active: z.enum(["true", "false"]),
});

export async function updateUser(formData: FormData): Promise<void> {
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session, orgSlug } = await requireAdminSession();

  // Un admin no puede quitarse a sí mismo el rol ni desactivar su propia cuenta — evita que la
  // organización se quede sin nadie que pueda entrar al panel.
  if (parsed.data.userId === session.user.id && (parsed.data.role !== "ADMIN" || parsed.data.active !== "true")) {
    redirect("/admin/usuarios?error=no_autogestion");
  }

  const orgId = await resolveOrgId(orgSlug);
  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.orgId !== orgId) {
    notFound();
  }

  await db.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role, active: parsed.data.active === "true" },
  });

  const changes: string[] = [];
  if (parsed.data.role !== user.role) changes.push(`rol ${user.role} → ${parsed.data.role}`);
  const newActive = parsed.data.active === "true";
  if (newActive !== user.active) changes.push(newActive ? "reactivado" : "desactivado");
  if (changes.length > 0) {
    await logAdminAction({
      orgId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      action: "user.update",
      summary: `Actualizó a ${user.name}: ${changes.join(", ")}`,
    });
  }

  redirect("/admin/usuarios?ok=usuario_actualizado");
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function resetUserPassword(formData: FormData): Promise<void> {
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    redirect("/admin/usuarios?error=datos_invalidos");
  }

  const { session, orgSlug } = await requireAdminSession();

  const orgId = await resolveOrgId(orgSlug);
  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.orgId !== orgId) {
    notFound();
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  await logAdminAction({
    orgId,
    actorUserId: session.user.id,
    actorName: session.user.name,
    action: "user.resetPassword",
    summary: `Reseteó la contraseña de ${user.name}`,
  });

  redirect("/admin/usuarios?ok=clave_actualizada");
}

const blockSlotSchema = z.object({
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional(),
});

// Bloquea un horario por mantenimiento (ej. luces dañadas) sin que exista una reserva real.
export async function blockSlot(formData: FormData): Promise<void> {
  const parsed = blockSlotSchema.safeParse({
    venueId: formData.get("venueId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: parsed.data.venueId } });
  if (!venue || venue.orgId !== org.id) {
    notFound();
  }

  // Si ya hay una reserva real en ese horario, no se puede bloquear por mantenimiento.
  const dateObj = new Date(`${parsed.data.date}T00:00:00.000-05:00`);
  const existingBooking = await db.booking.findFirst({
    where: {
      venueId: venue.id,
      date: dateObj,
      startTime: parsed.data.startTime,
      status: { in: ["PENDIENTE_PAGO", "CONFIRMADA", "EN_CURSO"] },
    },
  });
  if (existingBooking) {
    redirect(`/admin/mantenimiento?venueId=${venue.id}&date=${parsed.data.date}&error=horario_ocupado`);
  }

  await db.slotBlock.create({
    data: {
      orgId: org.id,
      venueId: venue.id,
      date: dateObj,
      startTime: parsed.data.startTime,
      reason: parsed.data.reason,
    },
  });

  redirect(`/admin/mantenimiento?venueId=${venue.id}&date=${parsed.data.date}&bloqueado=1`);
}

const unblockSlotSchema = z.object({
  slotBlockId: z.string().min(1),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function unblockSlot(formData: FormData): Promise<void> {
  const parsed = unblockSlotSchema.safeParse({
    slotBlockId: formData.get("slotBlockId"),
    venueId: formData.get("venueId"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { orgSlug } = await requireAdminSession();

  const orgId = await resolveOrgId(orgSlug);
  const block = await db.slotBlock.findUnique({ where: { id: parsed.data.slotBlockId } });
  if (!block || block.orgId !== orgId) {
    notFound();
  }

  await db.slotBlock.delete({ where: { id: block.id } });

  redirect(`/admin/mantenimiento?venueId=${parsed.data.venueId}&date=${parsed.data.date}&desbloqueado=1`);
}
