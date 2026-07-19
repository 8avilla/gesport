import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cancelConfirmedBooking } from "@/lib/admin/actions";
import { getAgendaBookings, getUpcomingBookings } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { BookingStatus } from "@/lib/booking/state-machine";
import {
  getPaymentState,
  LEGEND_PAYMENT_STATES,
  PAYMENT_STATE_BADGE_STYLE,
  PAYMENT_STATE_COLOR,
  PAYMENT_STATE_LABEL,
  STATUS_BADGE_STYLE,
  STATUS_LABEL,
} from "@/lib/booking/status-display";
import { businessDayRange, formatBusinessDayLabel, todayBusinessDate } from "@/lib/time/business-day";
import { Prisma, VenueType } from "@/lib/generated/prisma";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { SubmitButton } from "@/app/components/SubmitButton";
import { AgendaDateNav } from "./AgendaDateNav";
import { AgendaGrid } from "./AgendaGrid";
import { BookingsTable, BOOKING_LIST_LIMIT } from "./BookingsTable";
import { NuevaReservaButton } from "./NuevaReservaButton";
import { ReservaDrawerProvider } from "./ReservaDrawerProvider";

const RECURRING_ERROR_MESSAGES: Record<string, string> = {
  recurrente_rango_invalido: "La fecha de fin debe ser igual o posterior a la fecha de inicio.",
  recurrente_demasiadas_ocurrencias: "Ese rango genera demasiadas fechas (máximo 52 semanas). Acorta el rango.",
  recurrente_cupo_no_disponible:
    "Uno o más horarios de esa serie ya están ocupados. No se creó ninguna reserva — ajusta el " +
    "horario o el rango de fechas.",
  // De confirmSolicitud (lib/admin/actions.ts) — alguien más tomó esa hora con una reserva real
  // mientras la solicitud esperaba confirmación.
  cupo_no_disponible: "Ese horario ya fue tomado por otra reserva mientras la solicitud esperaba — no se pudo confirmar.",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

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

export default async function AdminReservasPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    fecha?: string;
    nueva?: string;
    nuevaVenueId?: string;
    nuevaStartTime?: string;
    creada?: string;
    dateFrom?: string;
    dateTo?: string;
    venueId?: string;
    type?: string;
    status?: string;
    name?: string;
    phone?: string;
    error?: string;
    recurrente?: string;
    cancelada?: string;
    pagoRegistrado?: string;
    solicitudConfirmada?: string;
  }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const params = await searchParams;
  const {
    vista: vistaParam,
    fecha: fechaParam,
    nueva,
    nuevaVenueId,
    nuevaStartTime,
    creada,
    dateFrom: dateFromParam,
    dateTo: dateToParam,
    venueId: venueIdParam,
    type: typeParam,
    status: statusParam,
    name: nameParam,
    phone: phoneParam,
    error,
    recurrente,
    cancelada,
    pagoRegistrado,
    solicitudConfirmada,
  } = params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({
    where: { orgId: organization.id },
    include: { priceRules: true },
    orderBy: { name: "asc" },
  });
  const venueIds = new Set(venues.map((venue) => venue.id));

  const vista: "agenda" | "lista" = vistaParam === "lista" ? "lista" : "agenda";
  const fecha = fechaParam && DATE_RE.test(fechaParam) ? fechaParam : todayBusinessDate();
  const isToday = fecha === todayBusinessDate();
  const { weekday, day, month } = formatBusinessDayLabel(fecha);

  let agendaData: Awaited<ReturnType<typeof getAgendaBookings>> | null = null;
  let upcoming: Awaited<ReturnType<typeof getUpcomingBookings>> = [];
  let bookingsTableProps: {
    bookings: Prisma.BookingGetPayload<{ include: { venue: true } }>[];
    truncated: boolean;
    isSingleDay: boolean;
    filters: Record<string, string | undefined>;
    hasActiveFilters: boolean;
  } | null = null;

  // Filtro del botón "Filtros" de la vista agenda — comparte los nombres de parámetro venueId/status
  // con la vista lista (mismo significado en ambas), pero cada vista solo los aplica a su propia
  // consulta.
  const agendaVenueIdFilter = venueIdParam && venueIds.has(venueIdParam) ? venueIdParam : undefined;
  const agendaStatusFilter =
    statusParam && (Object.values(BookingStatus) as string[]).includes(statusParam)
      ? (statusParam as BookingStatus)
      : undefined;
  const hasActiveAgendaFilters = Boolean(agendaVenueIdFilter || agendaStatusFilter);

  if (vista === "agenda") {
    [agendaData, upcoming] = await Promise.all([
      getAgendaBookings(organization.id, fecha),
      getUpcomingBookings(organization.id, fecha),
    ]);

    if (agendaVenueIdFilter) {
      agendaData = { ...agendaData, venues: agendaData.venues.filter((v) => v.id === agendaVenueIdFilter) };
    }
    if (agendaStatusFilter) {
      const filteredEntries = Object.entries(agendaData.bookingsByVenue).map(
        ([venueId, bookings]) => [venueId, bookings.filter((b) => b.status === agendaStatusFilter)] as const,
      );
      agendaData = { ...agendaData, bookingsByVenue: Object.fromEntries(filteredEntries) };
    }
  } else {
    // Sin parámetros de fecha en absoluto = primera visita a la vista lista → default a "hoy". Una
    // vez el admin usa el formulario (aunque deje ambos campos vacíos), sí se respeta lo que haya
    // puesto — vacío significa "sin límite" en ese extremo del rango.
    const dateParamsPresent = dateFromParam !== undefined || dateToParam !== undefined;
    const dateFromFilter = dateFromParam && DATE_RE.test(dateFromParam) ? dateFromParam : undefined;
    const dateToFilter = dateToParam && DATE_RE.test(dateToParam) ? dateToParam : undefined;
    const effectiveDateFrom = dateParamsPresent ? dateFromFilter : todayBusinessDate();
    const effectiveDateTo = dateParamsPresent ? dateToFilter : todayBusinessDate();
    const isSingleDay = Boolean(effectiveDateFrom && effectiveDateFrom === effectiveDateTo);

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
    if (venueIdFilter) where.venueId = venueIdFilter;
    if (typeFilter) where.venue = { type: typeFilter };
    if (statusFilter) where.status = statusFilter;
    if (nameFilter) where.customerName = { contains: nameFilter, mode: "insensitive" };
    if (phoneFilter) where.customerPhone = { contains: phoneFilter, mode: "insensitive" };

    const bookings = await db.booking.findMany({
      where,
      include: { venue: true },
      orderBy: isSingleDay ? [{ startTime: "asc" }] : [{ date: "asc" }, { startTime: "asc" }],
      take: BOOKING_LIST_LIMIT,
    });

    bookingsTableProps = {
      bookings,
      truncated: bookings.length === BOOKING_LIST_LIMIT,
      isSingleDay,
      filters: {
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        venueId: venueIdFilter,
        type: typeFilter,
        status: statusFilter,
        name: nameFilter,
        phone: phoneFilter,
      },
      hasActiveFilters: Boolean(venueIdFilter || typeFilter || statusFilter || nameFilter || phoneFilter),
    };
  }

  return (
    <ReservaDrawerProvider
      venues={venues.map((v) => ({
        id: v.id,
        name: v.name,
        hourlyRate: v.hourlyRate,
        priceRules: v.priceRules.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          price: r.price,
        })),
      }))}
      defaultDate={fecha}
      defaultOpen={nueva === "1"}
      defaultVenueId={nuevaVenueId && venueIds.has(nuevaVenueId) ? nuevaVenueId : undefined}
      defaultStartTime={nuevaStartTime}
      error={error}
    >
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="mt-1 text-sm text-gray-500">Agenda de horarios por canchas y disponibilidad en tiempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NuevaReservaButton className="flex-1 rounded-md bg-emerald-700 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-800 sm:flex-none" />

          <Link
            href="/admin/reservas/recurrente"
            className="hidden rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:inline-flex"
          >
            🔁 Reserva recurrente
          </Link>
        </div>
      </div>

      {vista === "agenda" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AgendaDateNav fecha={fecha} isToday={isToday} weekday={weekday} day={day} month={month} />

          <details className="group relative ml-auto">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
              🔽 Filtros
              {hasActiveAgendaFilters && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
            </summary>
            <form
              method="get"
              className="absolute right-0 z-10 mt-1 grid w-64 gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg"
            >
              <input type="hidden" name="vista" value="agenda" />
              <input type="hidden" name="fecha" value={fecha} />
              <label className="text-xs font-medium text-gray-500">
                Cancha
                <select
                  name="venueId"
                  defaultValue={agendaVenueIdFilter ?? ""}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="">Todas</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-500">
                Estado
                <select
                  name="status"
                  defaultValue={agendaStatusFilter ?? ""}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-3">
                <SubmitButton className="flex-1 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">
                  Aplicar
                </SubmitButton>
                {hasActiveAgendaFilters && (
                  <Link href={`/admin/reservas?vista=agenda&fecha=${fecha}`} className="text-sm text-gray-500 underline">
                    Limpiar
                  </Link>
                )}
              </div>
            </form>
          </details>
        </div>
      )}

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
      {creada === "1" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Reserva creada correctamente.</span>
        </p>
      )}
      {cancelada === "1" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Reserva cancelada correctamente.</span>
        </p>
      )}
      {pagoRegistrado === "1" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Pago registrado correctamente.</span>
        </p>
      )}
      {solicitudConfirmada === "1" && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>✅</span>
          <span>Solicitud confirmada — el horario quedó reservado.</span>
        </p>
      )}


      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full rounded-md border border-gray-300 bg-white p-1 sm:w-auto">
          <Link
            href={`/admin/reservas?vista=agenda&fecha=${fecha}`}
            className={`flex-1 rounded px-3 py-1.5 text-center text-sm font-medium sm:flex-none ${
              vista === "agenda" ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            📅 Vista agenda
          </Link>
          <Link
            href="/admin/reservas?vista=lista"
            className={`flex-1 rounded px-3 py-1.5 text-center text-sm font-medium sm:flex-none ${
              vista === "lista" ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            ☰ Vista lista
          </Link>
        </div>

        {vista === "agenda" && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {LEGEND_PAYMENT_STATES.map((state) => (
              <span key={state} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PAYMENT_STATE_COLOR[state] }}
                />
                {PAYMENT_STATE_LABEL[state]}
              </span>
            ))}
            {/* Cancelada no es un estado de pago (getPaymentState la deja fuera del modelo), pero
                los bloques cancelados se siguen mostrando en la grilla — la leyenda los explica. */}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              {STATUS_LABEL.CANCELADA}
            </span>
            {/* Solicitud sin pago (Venue.requiresPayment=false) tampoco es un estado de pago — no
                bloquea el cupo hasta que el admin la confirme. */}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
              {STATUS_LABEL.SOLICITADA}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4">
        {vista === "agenda" && agendaData ? (
          <AgendaGrid
            venues={agendaData.venues}
            bookingsByVenue={agendaData.bookingsByVenue}
            blockedByComboByVenue={agendaData.blockedByComboByVenue}
            dateIso={fecha}
          />
        ) : bookingsTableProps ? (
          <BookingsTable
            venues={venues}
            bookings={bookingsTableProps.bookings}
            truncated={bookingsTableProps.truncated}
            isSingleDay={bookingsTableProps.isSingleDay}
            filters={bookingsTableProps.filters}
            hasActiveFilters={bookingsTableProps.hasActiveFilters}
          />
        ) : null}
      </div>

      {vista === "agenda" && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Próximas reservas</h2>
          </div>

          {upcoming.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <div className="text-2xl">📅</div>
              <p className="mt-2">
                {isToday ? "No tienes reservas programadas para hoy." : "Sin reservas ese día."}
              </p>
              {isToday && <p className="text-gray-400">¡Agenda tu primera reserva!</p>}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="w-16 shrink-0">
                    <div className="text-sm font-semibold text-gray-900">{booking.startTime}</div>
                    <div className="text-xs text-gray-400">{isToday ? "Hoy" : fecha}</div>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span aria-hidden="true">{VENUE_TYPE_ICON[booking.venueType] ?? "🏟️"}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{booking.venueName}</div>
                      <div className="truncate text-xs text-gray-500">{VENUE_TYPE_LABEL[booking.venueType] ?? booking.venueType}</div>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900">{booking.customerName || "Sin nombre"}</div>
                    <div className="truncate text-xs text-gray-500">{booking.customerPhone}</div>
                  </div>

                  <div className="hidden text-sm text-gray-500 sm:block">
                    {formatDuration(booking.startTime, booking.endTime)} · {booking.startTime}-{booking.endTime}
                  </div>

                  <StatusBadge status={booking.status} totalAmount={booking.totalAmount} depositAmount={booking.depositAmount} />

                  {booking.status === BookingStatus.CONFIRMADA ? (
                    <details className="group relative">
                      <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
                        ⋮
                      </summary>
                      <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg">
                        <form action={cancelConfirmedBooking}>
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <input type="hidden" name="vista" value="agenda" />
                          <input type="hidden" name="fecha" value={fecha} />
                          <SubmitButton
                            confirmMessage="¿Cancelar esta reserva confirmada?"
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Cancelar reserva
                          </SubmitButton>
                        </form>
                      </div>
                    </details>
                  ) : (
                    <span className="w-7" />
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 px-4 py-3 text-center">
            <Link href="/admin/reservas?vista=lista" className="text-sm font-medium text-emerald-700 hover:underline">
              Ver todas las reservas →
            </Link>
          </div>
        </div>
      )}
    </main>
    </ReservaDrawerProvider>
  );
}
