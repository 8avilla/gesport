import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cancelConfirmedBooking, createRecurringBooking } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { BookingStatus } from "@/lib/booking/state-machine";
import { businessDayRange, todayBusinessDate } from "@/lib/time/business-day";
import { Prisma, VenueType } from "@/lib/generated/prisma";
import { SubmitButton } from "@/app/components/SubmitButton";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
  EXPIRADA: "Expirada",
};

// Un color por estado para que la lista se lea de un vistazo sin tener que leer cada etiqueta.
const STATUS_BADGE_STYLE: Record<string, string> = {
  PENDIENTE_PAGO: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  CONFIRMADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  EN_CURSO: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  FINALIZADA: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  CANCELADA: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  NO_SHOW: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  EXPIRADA: "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200",
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

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

// Tope defensivo para "todas las reservas" sin filtro de fecha — evita traer miles de documentos si
// el negocio lleva años operando. No es paginación real (nadie necesita hojear reservas viejas de a
// 20 en 20 aquí); si se llega al tope, se le sugiere al admin acotar con los filtros.
const BOOKING_LIST_LIMIT = 300;

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

export default async function AdminReservasPage({
  searchParams,
}: {
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
  const { orgSlug } = await requireAdminSession();
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
    take: BOOKING_LIST_LIMIT,
  });
  const truncated = bookings.length === BOOKING_LIST_LIMIT;

  const hasActiveFilters =
    Boolean(venueIdFilter || typeFilter || statusFilter || nameFilter || phoneFilter) || !isToday;

  const title = isToday
    ? "Reservas de hoy"
    : isSingleDay
      ? `Reservas — ${effectiveDateFrom}`
      : effectiveDateFrom || effectiveDateTo
        ? `Reservas — ${effectiveDateFrom ?? "…"} a ${effectiveDateTo ?? "…"}`
        : "Todas las reservas";

  // Campos ocultos que preservan los filtros activos al cancelar una reserva desde la lista, para
  // que el admin no pierda su vista actual (rango de fechas, cancha, tipo, estado, búsqueda).
  const cancelFilterFields = (
    <>
      <input type="hidden" name="dateFrom" value={effectiveDateFrom ?? ""} />
      <input type="hidden" name="dateTo" value={effectiveDateTo ?? ""} />
      {venueIdFilter && <input type="hidden" name="venueId" value={venueIdFilter} />}
      {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
      {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
      {nameFilter && <input type="hidden" name="name" value={nameFilter} />}
      {phoneFilter && <input type="hidden" name="phone" value={phoneFilter} />}
    </>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">
          {bookings.length} {bookings.length === 1 ? "reserva encontrada" : "reservas encontradas"}
          {truncated && " (mostrando las primeras — acota los filtros para ver el resto)"}
        </p>
      </div>

      {error && RECURRING_ERROR_MESSAGES[error] && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <span>⚠️</span>
          <span>{RECURRING_ERROR_MESSAGES[error]}</span>
        </p>
      )}

      {recurrente === "creada" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Reserva recurrente creada: se generaron todas las ocurrencias, ya confirmadas.</span>
        </p>
      )}

      <details className="group mt-6 rounded-lg border border-gray-200 bg-white">
        <summary
          className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium
            text-gray-700 [&::-webkit-details-marker]:hidden"
        >
          <span>🔁 Nueva reserva recurrente</span>
          <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>

        <form action={createRecurringBooking} className="grid gap-5 border-t border-gray-100 p-4 sm:grid-cols-3">
          <fieldset className="grid gap-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cliente</legend>
            <div>
              <label className="block text-xs font-medium text-gray-500">Cancha</label>
              <select name="venueId" required className={INPUT_CLASS}>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Nombre</label>
              <input type="text" name="customerName" required minLength={2} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Teléfono</label>
              <input type="tel" name="customerPhone" required minLength={7} className={INPUT_CLASS} />
            </div>
          </fieldset>

          <fieldset className="grid gap-3 self-start">
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Horario</legend>
            <div>
              <label className="block text-xs font-medium text-gray-500">Hora inicio</label>
              <input type="time" name="startTime" required className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Hora fin</label>
              <input type="time" name="endTime" required className={INPUT_CLASS} />
            </div>
          </fieldset>

          <fieldset className="grid gap-3 self-start">
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Repetición</legend>
            <div>
              <label className="block text-xs font-medium text-gray-500">Primera fecha</label>
              <input type="date" name="startDate" required className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Repetir hasta</label>
              <input type="date" name="endDate" required className={INPUT_CLASS} />
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-3">
            <input type="checkbox" name="requiresDeposit" className="h-4 w-4 rounded border-gray-300" />
            Requiere abono (se calcula con el % de abono configurado en la organización)
          </label>

          <p className="text-xs text-gray-500 sm:col-span-3">
            Se repite semanalmente (mismo día de la semana que la primera fecha). Si no marcas &ldquo;Requiere
            abono&rdquo;, el cliente paga todo en cancha, como cualquier reserva confirmada. Si algún horario ya
            está ocupado, no se crea ninguna reserva de la serie.
          </p>

          <div className="sm:col-span-3">
            <SubmitButton
              pendingLabel="Creando…"
              className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Crear reserva recurrente
            </SubmitButton>
          </div>
        </form>
      </details>

      <form
        method="get"
        className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4
          sm:grid-cols-4 lg:grid-cols-7"
      >
        <div>
          <label className="block text-xs font-medium text-gray-500">📅 Desde</label>
          <input type="date" name="dateFrom" defaultValue={effectiveDateFrom ?? ""} className={INPUT_CLASS} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">📅 Hasta</label>
          <input type="date" name="dateTo" defaultValue={effectiveDateTo ?? ""} className={INPUT_CLASS} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">🏟️ Cancha</label>
          <select name="venueId" defaultValue={venueIdFilter ?? ""} className={INPUT_CLASS}>
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
          <select name="type" defaultValue={typeFilter ?? ""} className={INPUT_CLASS}>
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
          <select name="status" defaultValue={statusFilter ?? ""} className={INPUT_CLASS}>
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
            defaultValue={nameFilter ?? ""}
            placeholder="Contiene…"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">📱 Teléfono</label>
          <input
            type="text"
            name="phone"
            defaultValue={phoneFilter ?? ""}
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
            <Link href="/admin/reservas" className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
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
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {booking.status === BookingStatus.CONFIRMADA && (
                        <form action={cancelConfirmedBooking} className="inline">
                          <input type="hidden" name="bookingId" value={booking.id} />
                          {cancelFilterFields}
                          <SubmitButton
                            pendingLabel="Cancelando…"
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white
                              hover:bg-red-700"
                          >
                            Cancelar
                          </SubmitButton>
                        </form>
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
                    <StatusBadge status={booking.status} />
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
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Cancelar reserva
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
