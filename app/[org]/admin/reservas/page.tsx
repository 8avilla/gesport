import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cancelConfirmedBooking, createRecurringBooking } from "@/lib/admin/actions";
import { BookingStatus } from "@/lib/booking/state-machine";
import { businessDayRange, todayBusinessDate } from "@/lib/time/business-day";
import { Prisma, VenueType } from "@/lib/generated/prisma";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
  EXPIRADA: "Expirada",
};

const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_8: "Fútbol 8",
  PADEL: "Pádel",
};

const RECURRING_ERROR_MESSAGES: Record<string, string> = {
  recurrente_rango_invalido: "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
  recurrente_demasiadas_ocurrencias: "Ese rango genera demasiadas fechas (máximo 52 semanas). Acorta el rango.",
  recurrente_cupo_no_disponible:
    "Uno o más horarios de esa serie ya están ocupados. No se creó ninguna reserva — ajusta el " +
    "horario o el rango de fechas.",
};

export default async function AdminReservasPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    venueId?: string;
    type?: string;
    status?: string;
    name?: string;
    phone?: string;
    error?: string;
    recurrente?: string;
  }>;
}) {
  const { org: orgSlug } = await params;
  const {
    dateFrom: dateFromParam,
    dateTo: dateToParam,
    venueId: venueIdParam,
    type: typeParam,
    status: statusParam,
    name: nameParam,
    phone: phoneParam,
    error,
    recurrente,
  } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });
  const venueIds = new Set(venues.map((venue) => venue.id));

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  // Sin parámetros de fecha en absoluto = primera visita a la página → default a "hoy". Una vez el
  // admin usa el formulario (aunque deje ambos campos vacíos), sí se respeta lo que haya puesto —
  // vacío significa "sin límite" en ese extremo del rango.
  const dateParamsPresent = dateFromParam !== undefined || dateToParam !== undefined;
  const dateFromFilter = dateFromParam && DATE_RE.test(dateFromParam) ? dateFromParam : undefined;
  const dateToFilter = dateToParam && DATE_RE.test(dateToParam) ? dateToParam : undefined;
  const effectiveDateFrom = dateParamsPresent ? dateFromFilter : todayBusinessDate();
  const effectiveDateTo = dateParamsPresent ? dateToFilter : todayBusinessDate();
  const isSingleDay = Boolean(effectiveDateFrom && effectiveDateFrom === effectiveDateTo);
  const isToday = isSingleDay && effectiveDateFrom === todayBusinessDate();

  const venueIdFilter = venueIdParam && venueIds.has(venueIdParam) ? venueIdParam : undefined;
  const typeFilter =
    typeParam && (Object.values(VenueType) as string[]).includes(typeParam) ? (typeParam as VenueType) : undefined;
  const statusFilter =
    statusParam && (Object.values(BookingStatus) as string[]).includes(statusParam)
      ? (statusParam as BookingStatus)
      : undefined;
  const nameFilter = nameParam?.trim() || undefined;
  const phoneFilter = phoneParam?.trim() || undefined;

  const where: Prisma.BookingWhereInput = { orgId: organization.id };
  if (effectiveDateFrom || effectiveDateTo) {
    where.date = {
      ...(effectiveDateFrom ? { gte: businessDayRange(effectiveDateFrom).start } : {}),
      ...(effectiveDateTo ? { lt: businessDayRange(effectiveDateTo).end } : {}),
    };
  }
  if (venueIdFilter) {
    where.venueId = venueIdFilter;
  }
  if (typeFilter) {
    where.venue = { type: typeFilter };
  }
  if (statusFilter) {
    where.status = statusFilter;
  }
  if (nameFilter) {
    where.customerName = { contains: nameFilter, mode: "insensitive" };
  }
  if (phoneFilter) {
    where.customerPhone = { contains: phoneFilter, mode: "insensitive" };
  }

  const bookings = await db.booking.findMany({
    where,
    include: { venue: true },
    orderBy: isSingleDay ? [{ startTime: "asc" }] : [{ date: "asc" }, { startTime: "asc" }],
  });

  const hasActiveFilters =
    Boolean(venueIdFilter || typeFilter || statusFilter || nameFilter || phoneFilter) || !isToday;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">
        {isToday
          ? "Reservas de hoy"
          : isSingleDay
            ? `Reservas — ${effectiveDateFrom}`
            : effectiveDateFrom || effectiveDateTo
              ? `Reservas — ${effectiveDateFrom ?? "…"} a ${effectiveDateTo ?? "…"}`
              : "Todas las reservas"}
      </h1>

      {error && RECURRING_ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{RECURRING_ERROR_MESSAGES[error]}</p>
      )}

      {recurrente === "creada" && (
        <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Reserva recurrente creada: se generaron todas las ocurrencias, ya confirmadas.
        </p>
      )}

      <details className="mt-6 rounded-lg border border-gray-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">+ Nueva reserva recurrente</summary>

        <form action={createRecurringBooking} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input type="hidden" name="orgSlug" value={orgSlug} />

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500">Cancha</label>
            <select
              name="venueId"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">Nombre del cliente</label>
            <input
              type="text"
              name="customerName"
              required
              minLength={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">Teléfono</label>
            <input
              type="tel"
              name="customerPhone"
              required
              minLength={7}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">Hora inicio</label>
            <input
              type="time"
              name="startTime"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">Hora fin</label>
            <input
              type="time"
              name="endTime"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">Primera fecha</label>
            <input
              type="date"
              name="startDate"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">Repetir hasta</label>
            <input
              type="date"
              name="endDate"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
            />
          </div>

          <p className="col-span-2 self-end text-xs text-gray-500 sm:col-span-4">
            Se repite semanalmente (mismo día de la semana que la primera fecha). No requiere abono — el cliente
            paga en cancha, como cualquier reserva confirmada.
          </p>

          <div className="col-span-2 sm:col-span-4">
            <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white">
              Crear reserva recurrente
            </button>
          </div>
        </form>
      </details>

      <form method="get" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-500">Desde</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={effectiveDateFrom ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Hasta</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={effectiveDateTo ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Cancha</label>
          <select
            name="venueId"
            defaultValue={venueIdFilter ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          >
            <option value="">Todas</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Tipo de cancha</label>
          <select
            name="type"
            defaultValue={typeFilter ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(VENUE_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Estado</label>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Nombre</label>
          <input
            type="text"
            name="name"
            defaultValue={nameFilter ?? ""}
            placeholder="Contiene…"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Teléfono</label>
          <input
            type="text"
            name="phone"
            defaultValue={phoneFilter ?? ""}
            placeholder="Contiene…"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2.5 text-sm"
          />
        </div>

        <div className="col-span-2 flex items-end gap-3 sm:col-span-4">
          <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white">
            Filtrar
          </button>
          {hasActiveFilters && (
            <Link href={`/${orgSlug}/admin/reservas`} className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
        </div>
      </form>

      <ul className="mt-6 grid gap-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {booking.recurringBookingId && <span title="Reserva recurrente">🔁 </span>}
                {booking.venue.name} — {!isSingleDay && `${booking.date.toISOString().slice(0, 10)} `}
                {booking.startTime}
              </span>
              <span className="text-xs text-gray-500">{STATUS_LABEL[booking.status] ?? booking.status}</span>
            </div>
            <div className="text-sm text-gray-500">
              {booking.customerName} · {booking.customerPhone}
            </div>

            {booking.status === BookingStatus.CONFIRMADA && (
              <form action={cancelConfirmedBooking} className="mt-3">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="dateFrom" value={effectiveDateFrom ?? ""} />
                <input type="hidden" name="dateTo" value={effectiveDateTo ?? ""} />
                {venueIdFilter && <input type="hidden" name="venueId" value={venueIdFilter} />}
                {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
                {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
                {nameFilter && <input type="hidden" name="name" value={nameFilter} />}
                {phoneFilter && <input type="hidden" name="phone" value={phoneFilter} />}
                <button type="submit" className="rounded-md bg-red-600 px-3 py-2.5 text-sm text-white">
                  Cancelar reserva
                </button>
              </form>
            )}
          </li>
        ))}

        {bookings.length === 0 && <li className="text-sm text-gray-500">Sin reservas para estos filtros.</li>}
      </ul>
    </main>
  );
}
