import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { BookingStatus, isBlockingStatus } from "@/lib/booking/state-machine";
import { CLOSING_HOUR, OPENING_HOUR } from "@/lib/booking/availability";
import { getVenueUnitIds } from "@/lib/booking/slot-locks";
import { addBusinessDays, businessDayRange, businessTimeNow, todayBusinessDate } from "@/lib/time/business-day";

const VENUE_STATS_WINDOW_DAYS = 30;
const COUNTED_BOOKING_STATUSES = [BookingStatus.CONFIRMADA, BookingStatus.EN_CURSO, BookingStatus.FINALIZADA];

export interface VenueStats30d {
  bookingsCount: number;
  hoursBooked: number;
  revenue: number;
  occupancyRate: number; // 0..1
}

// Últimos 30 días de una cancha puntual, para la página de detalle (/admin/canchas/[venueId]).
// "Horas reservadas" hoy coincide con "Reservas" porque cada turno dura 1 hora fija en este sistema
// — se muestran como dos métricas separadas por paridad con el mockup, aunque de momento son el
// mismo número. La ocupación es una métrica simple (no descuenta mantenimiento ni feriados):
// reservas contadas ÷ (30 días × horas de operación por día).
export async function getVenueStats30d(venueId: string): Promise<VenueStats30d> {
  const today = todayBusinessDate();
  const { start } = businessDayRange(addBusinessDays(today, -(VENUE_STATS_WINDOW_DAYS - 1)));
  const { end } = businessDayRange(today);

  const bookings = await db.booking.findMany({
    where: { venueId, date: { gte: start, lt: end }, status: { in: COUNTED_BOOKING_STATUSES } },
    select: { totalAmount: true },
  });

  const bookingsCount = bookings.length;
  const revenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const operatingHoursPerDay = CLOSING_HOUR - OPENING_HOUR;
  const occupancyRate = bookingsCount / (VENUE_STATS_WINDOW_DAYS * operatingHoursPerDay);

  return { bookingsCount, hoursBooked: bookingsCount, revenue, occupancyRate };
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
}

// Extraído de getDashboardMetrics para poder reutilizarlo también en /admin/alertas sin repetir el
// filtro "stock < umbral" (que Mongo/Prisma no puede expresar como where — se compara en JS).
export async function getLowStockProducts(orgId: string): Promise<LowStockProduct[]> {
  const products = await db.consumptionItem.findMany({ where: { orgId, active: true } });

  return products
    .filter((product) => product.stock < product.lowStockThreshold)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
    }));
}

export interface DashboardMetrics {
  bookingsByStatus: Record<string, number>;
  courtsRevenueToday: number;
  barRevenueToday: number;
  lowStockProducts: LowStockProduct[];
  openShift: boolean;
}

export async function getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const [bookings, lowStockProducts, openShift] = await Promise.all([
    db.booking.findMany({ where: { orgId, date: { gte: start, lt: end } } }),
    getLowStockProducts(orgId),
    db.cashShift.findFirst({ where: { orgId, status: "ABIERTO" } }),
  ]);

  const bookingsByStatus: Record<string, number> = {};
  let courtsRevenueToday = 0;
  let barRevenueToday = 0;

  for (const booking of bookings) {
    bookingsByStatus[booking.status] = (bookingsByStatus[booking.status] ?? 0) + 1;
    if (booking.status === BookingStatus.FINALIZADA) {
      courtsRevenueToday += booking.totalAmount;
      barRevenueToday += booking.consumptionTotal;
    }
  }

  return {
    bookingsByStatus,
    courtsRevenueToday,
    barRevenueToday,
    lowStockProducts,
    openShift: openShift !== null,
  };
}

export interface PendingPaymentBooking {
  id: string;
  venueName: string;
  customerName: string;
  startTime: string;
}

// Mismo scope de fecha (hoy) que getAdminAlertCounts — la lista real detrás del conteo de la
// campanita, para /admin/alertas.
export async function getPendingPaymentBookings(orgId: string): Promise<PendingPaymentBooking[]> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const bookings = await db.booking.findMany({
    where: { orgId, date: { gte: start, lt: end }, status: BookingStatus.PENDIENTE_PAGO },
    include: { venue: true },
    orderBy: { startTime: "asc" },
    take: 20,
  });

  return bookings.map((booking) => ({
    id: booking.id,
    venueName: booking.venue.name,
    customerName: booking.customerName || "Sin nombre todavía",
    startTime: booking.startTime,
  }));
}

export interface AdminAlertCounts {
  lowStockCount: number;
  pendingPaymentCount: number;
}

// Conteo liviano para el badge de notificaciones de la topbar (se corre en cada página del admin,
// vía el layout compartido) — separado de getDashboardMetrics porque ese trae TODAS las reservas
// de hoy con sus montos, más de lo que hace falta solo para un número en una campanita.
export async function getAdminAlertCounts(orgId: string): Promise<AdminAlertCounts> {
  const { start, end } = businessDayRange(todayBusinessDate());

  const [products, pendingPaymentCount] = await Promise.all([
    db.consumptionItem.findMany({
      where: { orgId, active: true },
      select: { stock: true, lowStockThreshold: true },
    }),
    db.booking.count({
      where: { orgId, date: { gte: start, lt: end }, status: BookingStatus.PENDIENTE_PAGO },
    }),
  ]);

  const lowStockCount = products.filter((product) => product.stock < product.lowStockThreshold).length;

  return { lowStockCount, pendingPaymentCount };
}

export interface DailyRevenue {
  date: string;
  courtsTotal: number;
  barTotal: number;
  finalizadas: number;
  canceladas: number;
  noShow: number;
  statusCounts: Record<string, number>;
}

export async function getRevenueReport(orgId: string, days: number): Promise<DailyRevenue[]> {
  const today = todayBusinessDate();
  const results: DailyRevenue[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dateIso = addBusinessDays(today, -i);
    const { start, end } = businessDayRange(dateIso);

    const bookings = await db.booking.findMany({ where: { orgId, date: { gte: start, lt: end } } });

    let courtsTotal = 0;
    let barTotal = 0;
    let finalizadas = 0;
    let canceladas = 0;
    let noShow = 0;
    const statusCounts: Record<string, number> = {};

    for (const booking of bookings) {
      statusCounts[booking.status] = (statusCounts[booking.status] ?? 0) + 1;

      if (booking.status === BookingStatus.FINALIZADA) {
        courtsTotal += booking.totalAmount;
        barTotal += booking.consumptionTotal;
        finalizadas += 1;
      } else if (booking.status === BookingStatus.CANCELADA) {
        canceladas += 1;
      } else if (booking.status === BookingStatus.NO_SHOW) {
        noShow += 1;
      }
    }

    results.push({ date: dateIso, courtsTotal, barTotal, finalizadas, canceladas, noShow, statusCounts });
  }

  return results;
}

export interface PaymentMethodBreakdown {
  cash: number;
  transfer: number;
  card: number;
}

// Suma lo que cada turno de caja CERRADO en el rango ya calculó como esperado por método — negocio.md
// §4 clasifica el cierre en Efectivo/Transferencia/Datáfono, dato que hoy solo se ve turno a turno.
export async function getPaymentMethodBreakdown(orgId: string, days: number): Promise<PaymentMethodBreakdown> {
  const today = todayBusinessDate();
  const { start } = businessDayRange(addBusinessDays(today, -(days - 1)));
  const { end } = businessDayRange(today);

  const shifts = await db.cashShift.findMany({
    where: { orgId, status: "CERRADO", closedAt: { gte: start, lt: end } },
    select: { expectedCash: true, expectedTransfer: true, expectedCard: true },
  });

  return shifts.reduce(
    (totals, shift) => ({
      cash: totals.cash + (shift.expectedCash ?? 0),
      transfer: totals.transfer + (shift.expectedTransfer ?? 0),
      card: totals.card + (shift.expectedCard ?? 0),
    }),
    { cash: 0, transfer: 0, card: 0 },
  );
}

const REVENUE_COUNTED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMADA,
  BookingStatus.EN_CURSO,
  BookingStatus.FINALIZADA,
];

export interface ReservasStatCards {
  reservasHoy: number;
  reservasHoyDeltaPct: number | null; // null = sin dato de ayer para comparar (evita mostrar "+Infinity%")
  ingresosHoy: number;
  ingresosHoyDeltaPct: number | null;
  ocupacionPromedio: number; // 0..1
  ocupacionLabel: "Muy alta" | "Alta" | "Baja";
  reservasPendientes: number;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Las 4 stat cards del header de /admin/reservas (vista agenda). "Ocupación promedio" asume 1 hora
// fija por turno (igual que getVenueStats30d) — bookingsCount de estado bloqueante ÷ (canchas × horas
// de operación del día).
export async function getReservasStatCards(orgId: string, dateIso: string): Promise<ReservasStatCards> {
  const { start, end } = businessDayRange(dateIso);
  const { start: yStart, end: yEnd } = businessDayRange(addBusinessDays(dateIso, -1));

  const [venuesCount, todayBookings, yesterdayBookings] = await Promise.all([
    db.venue.count({ where: { orgId } }),
    db.booking.findMany({ where: { orgId, date: { gte: start, lt: end } } }),
    db.booking.findMany({ where: { orgId, date: { gte: yStart, lt: yEnd } } }),
  ]);

  const countActive = (bookings: typeof todayBookings) =>
    bookings.filter((b) => b.status !== BookingStatus.CANCELADA).length;
  const sumRevenue = (bookings: typeof todayBookings) =>
    bookings
      .filter((b) => REVENUE_COUNTED_STATUSES.includes(b.status))
      .reduce((sum, b) => sum + b.totalAmount, 0);

  const reservasHoy = countActive(todayBookings);
  const ingresosHoy = sumRevenue(todayBookings);

  const blockingHoy = todayBookings.filter((b) => isBlockingStatus(b.status)).length;
  const capacityHoy = venuesCount * (CLOSING_HOUR - OPENING_HOUR);
  const ocupacionPromedio = capacityHoy > 0 ? blockingHoy / capacityHoy : 0;
  const ocupacionLabel = ocupacionPromedio >= 0.8 ? "Muy alta" : ocupacionPromedio >= 0.5 ? "Alta" : "Baja";

  const reservasPendientes = todayBookings.filter((b) => b.status === BookingStatus.PENDIENTE_PAGO).length;

  return {
    reservasHoy,
    reservasHoyDeltaPct: deltaPct(reservasHoy, countActive(yesterdayBookings)),
    ingresosHoy,
    ingresosHoyDeltaPct: deltaPct(ingresosHoy, sumRevenue(yesterdayBookings)),
    ocupacionPromedio,
    ocupacionLabel,
    reservasPendientes,
  };
}

export interface AgendaVenue {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
}

export interface AgendaBooking {
  id: string;
  venueId: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  recurringBookingId: string | null;
  // Para derivar el estado de pago (getPaymentState, lib/booking/status-display.ts) en la agenda.
  totalAmount: number;
  depositAmount: number;
  receiptUrl: string | null;
}

// Una cancha combinada (Venue.linkedVenueIds, ej. F9 armada sobre F7-A+F7-B) queda bloqueada sin
// tener Booking propio cuando se reserva alguna de sus canchas físicas, y viceversa — ver
// lib/booking/slot-locks.ts. La grilla de agenda necesita mostrar ESE bloqueo (no un "+Libre"
// engañoso) aunque no haya una reserva real para esa cancha a esa hora.
export interface AgendaBlockedSlot {
  venueName: string;
  customerName: string;
}

export interface AgendaData {
  venues: AgendaVenue[];
  bookingsByVenue: Record<string, AgendaBooking[]>;
  blockedByComboByVenue: Record<string, Record<string, AgendaBlockedSlot>>;
}

// Datos de la vista agenda (grid canchas × horas) para un solo día — incluye reservas canceladas
// (se muestran tachadas/rojas en el grid, igual que en el mockup) en vez de ocultarlas.
export async function getAgendaBookings(orgId: string, dateIso: string): Promise<AgendaData> {
  const { start, end } = businessDayRange(dateIso);

  const [venues, bookings] = await Promise.all([
    db.venue.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.booking.findMany({
      where: { orgId, date: { gte: start, lt: end } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const venueById = new Map(venues.map((v) => [v.id, v]));

  const bookingsByVenue: Record<string, AgendaBooking[]> = {};
  for (const venue of venues) {
    bookingsByVenue[venue.id] = [];
  }
  for (const booking of bookings) {
    (bookingsByVenue[booking.venueId] ??= []).push({
      id: booking.id,
      venueId: booking.venueId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      recurringBookingId: booking.recurringBookingId,
      totalAmount: booking.totalAmount,
      depositAmount: booking.depositAmount,
      receiptUrl: booking.receiptUrl,
    });
  }

  // Qué unitId físico queda ocupado a cada hora y por cuál reserva/cancha, para la cancha combinada
  // hermana. Solo CONFIRMADA/EN_CURSO cuentan acá (a propósito NO isBlockingStatus, que también
  // incluye PENDIENTE_PAGO) — la agenda muestra una reserva PENDIENTE_PAGO propia como "+ Libre"
  // (ver AgendaGrid.tsx), así que por consistencia tampoco debe bloquear a su cancha combinada
  // hermana con un "🔒 Combinada" por una reserva que ni siquiera se ve como ocupada en su propia
  // cancha. La protección real contra doble reserva (SlotLock/blockingSlotKey) no depende de esto —
  // sigue intacta, esto es solo qué se muestra.
  type Occupant = { venueId: string; venueName: string; customerName: string };
  const physicalOccupancyByUnit = new Map<string, Map<string, Occupant>>();
  for (const booking of bookings) {
    if (booking.status !== BookingStatus.CONFIRMADA && booking.status !== BookingStatus.EN_CURSO) continue;
    const bookingVenue = venueById.get(booking.venueId);
    if (!bookingVenue) continue;

    for (const unitId of getVenueUnitIds(bookingVenue)) {
      const byHour = physicalOccupancyByUnit.get(unitId) ?? new Map();
      byHour.set(booking.startTime, {
        venueId: booking.venueId,
        venueName: bookingVenue.name,
        customerName: booking.customerName,
      });
      physicalOccupancyByUnit.set(unitId, byHour);
    }
  }

  const blockedByComboByVenue: Record<string, Record<string, AgendaBlockedSlot>> = {};
  for (const venue of venues) {
    const blocked: Record<string, AgendaBlockedSlot> = {};
    for (const unitId of getVenueUnitIds(venue)) {
      const byHour = physicalOccupancyByUnit.get(unitId);
      if (!byHour) continue;
      for (const [startTime, occupant] of byHour) {
        if (occupant.venueId === venue.id) continue; // reserva propia, ya se muestra normal
        blocked[startTime] = { venueName: occupant.venueName, customerName: occupant.customerName };
      }
    }
    if (Object.keys(blocked).length > 0) {
      blockedByComboByVenue[venue.id] = blocked;
    }
  }

  return {
    venues: venues.map((v) => ({ id: v.id, name: v.name, type: v.type, capacity: v.capacity })),
    bookingsByVenue,
    blockedByComboByVenue,
  };
}

export interface UpcomingBooking {
  id: string;
  venueName: string;
  venueType: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalAmount: number;
  depositAmount: number;
}

// Lista "Próximas reservas" bajo la agenda: si se está viendo el día de hoy, solo turnos que aún no
// empezaron; si se está viendo otro día, el día completo.
export async function getUpcomingBookings(orgId: string, dateIso: string, limit = 8): Promise<UpcomingBooking[]> {
  const { start, end } = businessDayRange(dateIso);
  const isToday = dateIso === todayBusinessDate();

  const bookings = await db.booking.findMany({
    where: {
      orgId,
      date: { gte: start, lt: end },
      status: { not: BookingStatus.CANCELADA },
      ...(isToday ? { startTime: { gte: businessTimeNow() } } : {}),
    },
    include: { venue: true },
    orderBy: { startTime: "asc" },
    take: limit,
  });

  return bookings.map((b) => ({
    id: b.id,
    venueName: b.venue.name,
    venueType: b.venue.type,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    totalAmount: b.totalAmount,
    depositAmount: b.depositAmount,
  }));
}

export interface BookingReportRow {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  venueName: string;
  venueType: string;
  customerName: string;
  customerPhone: string;
  status: BookingStatus;
  // Canal registrado: settlementMethod (saldo+consumo al cerrar cuenta) o, si aún no se cerró,
  // paymentMethod (canal del abono inicial) — son enums disjuntos, nunca compiten por el mismo campo.
  paymentMethodLabel: string;
  totalAmount: number;
  consumptionTotal: number;
  // Lo efectivamente cobrado hasta ahora — mismo criterio que getReservasStatCards/getRevenueReport
  // (solo CONFIRMADA/EN_CURSO/FINALIZADA cuentan como plata real): abono para las que siguen abiertas,
  // total + consumo para las ya cerradas, $0 para pendientes/canceladas/no-show/expiradas.
  totalPaid: number;
}

export interface BookingReportFilters {
  dateFrom?: string;
  dateTo?: string;
  venueId?: string;
  type?: string;
  status?: BookingStatus;
  paymentMethod?: string;
  name?: string;
  phone?: string;
}

const SETTLEMENT_METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DATAFONO: "Datáfono",
};
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BOLD: "Bold",
  COMPROBANTE_MANUAL: "Comprobante manual",
};

export const REPORT_LIST_LIMIT = 500;

// Lo efectivamente cobrado hasta ahora en una reserva — mismo criterio en todo /admin/reportes y
// /admin/clientes (solo CONFIRMADA/EN_CURSO/FINALIZADA cuentan como plata real, igual que
// getReservasStatCards): abono para las que siguen abiertas, total + consumo para las ya cerradas,
// $0 para pendientes/canceladas/no-show/expiradas (nunca se cobró nada en firme).
function computeAmountPaid(booking: { status: BookingStatus; totalAmount: number; consumptionTotal: number; depositAmount: number }): number {
  if (booking.status === BookingStatus.FINALIZADA) {
    return booking.totalAmount + booking.consumptionTotal;
  }
  if (booking.status === BookingStatus.CONFIRMADA || booking.status === BookingStatus.EN_CURSO) {
    return booking.depositAmount;
  }
  return 0;
}

// Listado a nivel de reserva individual (no agregado por día como getRevenueReport) para que el
// admin pueda "sacar cuentas": fecha, hora, cancha, cliente, método de pago y lo cobrado, con
// filtros. Vive separado de getRevenueReport porque ese resume por día para el gráfico — esto es la
// data cruda detrás, para auditar/conciliar caso por caso.
export async function getBookingsReport(
  orgId: string,
  filters: BookingReportFilters,
): Promise<{ rows: BookingReportRow[]; truncated: boolean }> {
  const where: Prisma.BookingWhereInput = { orgId };
  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: businessDayRange(filters.dateFrom).start } : {}),
      ...(filters.dateTo ? { lt: businessDayRange(filters.dateTo).end } : {}),
    };
  }
  if (filters.venueId) where.venueId = filters.venueId;
  if (filters.type) where.venue = { type: filters.type as Prisma.EnumVenueTypeFilter["equals"] };
  if (filters.status) where.status = filters.status;
  if (filters.paymentMethod) {
    where.OR = [
      { settlementMethod: filters.paymentMethod as Prisma.EnumSettlementMethodNullableFilter["equals"] },
      { paymentMethod: filters.paymentMethod as Prisma.EnumPaymentMethodNullableFilter["equals"] },
    ];
  }
  if (filters.name?.trim()) where.customerName = { contains: filters.name.trim(), mode: "insensitive" };
  if (filters.phone?.trim()) where.customerPhone = { contains: filters.phone.trim(), mode: "insensitive" };

  const bookings = await db.booking.findMany({
    where,
    include: { venue: true },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: REPORT_LIST_LIMIT,
  });

  const rows = bookings.map((b) => {
    const paymentMethodLabel = b.settlementMethod
      ? SETTLEMENT_METHOD_LABEL[b.settlementMethod]
      : b.paymentMethod
        ? PAYMENT_METHOD_LABEL[b.paymentMethod]
        : "—";

    const totalPaid = computeAmountPaid(b);

    return {
      id: b.id,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      venueName: b.venue.name,
      venueType: b.venue.type,
      customerName: b.customerName || "Sin nombre",
      customerPhone: b.customerPhone,
      status: b.status,
      paymentMethodLabel,
      totalAmount: b.totalAmount,
      consumptionTotal: b.consumptionTotal,
      totalPaid,
    };
  });

  return { rows, truncated: bookings.length === REPORT_LIST_LIMIT };
}

export interface CustomerRow {
  phone: string;
  name: string;
  email: string | null;
  bookingsCount: number;
  cancelledCount: number;
  noShowCount: number;
  totalSpent: number;
  firstBookingDate: string; // "YYYY-MM-DD"
  lastBookingDate: string;
}

export interface CustomersStats {
  totalCustomers: number;
  newThisMonth: number;
  totalSpent: number;
  avgSpentPerCustomer: number;
}

export interface CustomersFilters {
  search?: string; // nombre o teléfono, contains
  sort?: "reciente" | "reservas" | "gastado" | "nombre";
}

export const CUSTOMER_LIST_LIMIT = 300;

// Clientes agrupados por teléfono (identificador estable — el nombre puede variar de tipeo entre
// reservas de la misma persona). Deliberadamente NO usa el modelo Customer (lib/db): ese es global
// entre organizaciones (login de "Mis reservas" por WhatsApp, sin orgId) y no sirve para un CRM por
// tenant — acá agregamos directo sobre Booking, que sí está acotado a orgId. Trae todas las reservas
// de la organización para agrupar en JS (mismo patrón que getReservasStatCards); a la escala de un
// solo complejo deportivo esto es liviano.
export async function getCustomersReport(
  orgId: string,
  filters: CustomersFilters,
): Promise<{ customers: CustomerRow[]; stats: CustomersStats; truncated: boolean }> {
  const bookings = await db.booking.findMany({
    where: { orgId },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      date: true,
      status: true,
      totalAmount: true,
      consumptionTotal: true,
      depositAmount: true,
    },
    orderBy: { date: "asc" },
  });

  type Group = {
    name: string;
    email: string | null;
    phone: string;
    bookingsCount: number;
    cancelledCount: number;
    noShowCount: number;
    totalSpent: number;
    firstDate: string;
    lastDate: string;
  };
  const groups = new Map<string, Group>();

  for (const b of bookings) {
    if (!b.customerPhone) continue;
    const dateIso = b.date.toISOString().slice(0, 10);
    const existing = groups.get(b.customerPhone);
    const spent = computeAmountPaid(b);

    if (!existing) {
      groups.set(b.customerPhone, {
        name: b.customerName || "Sin nombre",
        email: b.customerEmail,
        phone: b.customerPhone,
        bookingsCount: 1,
        cancelledCount: b.status === BookingStatus.CANCELADA ? 1 : 0,
        noShowCount: b.status === BookingStatus.NO_SHOW ? 1 : 0,
        totalSpent: spent,
        firstDate: dateIso,
        lastDate: dateIso,
      });
    } else {
      existing.bookingsCount += 1;
      if (b.status === BookingStatus.CANCELADA) existing.cancelledCount += 1;
      if (b.status === BookingStatus.NO_SHOW) existing.noShowCount += 1;
      existing.totalSpent += spent;
      existing.lastDate = dateIso; // bookings vienen ordenadas asc por fecha, así que la última pisa
      if (b.customerName) existing.name = b.customerName; // se queda con el nombre más reciente
      if (b.customerEmail) existing.email = b.customerEmail;
    }
  }

  let customers = Array.from(groups.values()).map((g) => ({
    phone: g.phone,
    name: g.name,
    email: g.email,
    bookingsCount: g.bookingsCount,
    cancelledCount: g.cancelledCount,
    noShowCount: g.noShowCount,
    totalSpent: g.totalSpent,
    firstBookingDate: g.firstDate,
    lastBookingDate: g.lastDate,
  }));

  const totalCustomers = customers.length;
  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const monthPrefix = todayBusinessDate().slice(0, 7);
  const newThisMonth = customers.filter((c) => c.firstBookingDate.slice(0, 7) === monthPrefix).length;

  const stats: CustomersStats = {
    totalCustomers,
    newThisMonth,
    totalSpent: totalSpentAll,
    avgSpentPerCustomer: totalCustomers > 0 ? Math.round(totalSpentAll / totalCustomers) : 0,
  };

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    customers = customers.filter(
      (c) => c.name.toLowerCase().includes(search) || c.phone.toLowerCase().includes(search),
    );
  }

  customers.sort((a, b) => {
    if (filters.sort === "reservas") return b.bookingsCount - a.bookingsCount;
    if (filters.sort === "gastado") return b.totalSpent - a.totalSpent;
    if (filters.sort === "nombre") return a.name.localeCompare(b.name);
    return b.lastBookingDate.localeCompare(a.lastBookingDate); // "reciente" (default)
  });

  const truncated = customers.length > CUSTOMER_LIST_LIMIT;
  return { customers: customers.slice(0, CUSTOMER_LIST_LIMIT), stats, truncated };
}
