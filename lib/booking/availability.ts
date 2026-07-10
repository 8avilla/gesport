import { db } from "@/lib/db";
import { addBusinessDays, businessDayRange, todayBusinessDate } from "@/lib/time/business-day";
import { BookingStatus } from "./state-machine";

// MVP: horario fijo de operación. Cuando haya un panel de administración (Fase 4), esto pasa a ser
// configuración por Organization en vez de una constante.
export const OPENING_HOUR = 8;
export const CLOSING_HOUR = 23;

export interface HourSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  // Motivo por el que no está disponible: reservado por un cliente, o bloqueado por el admin
  // (mantenimiento). Solo tiene valor cuando available es false.
  blockedReason?: "reservado" | "mantenimiento";
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function parseDateParam(dateParam: string | undefined): string {
  return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayBusinessDate();
}

export function todayIso(): string {
  return todayBusinessDate();
}

export async function getDaySlots(venueId: string, dateIso: string): Promise<HourSlot[]> {
  const { start, end } = businessDayRange(dateIso);

  const [blockingBookings, maintenanceBlocks] = await Promise.all([
    // Ojo: PENDIENTE_PAGO NO cuenta aquí a propósito. La grilla pública sigue mostrando el horario
    // como disponible mientras alguien más está a mitad de pago — solo Bold confirmando (CONFIRMADA)
    // lo marca como ocupado de verdad. La protección real contra doble-reserva sigue siendo el índice
    // único de blockingSlotKey al crear la reserva (state-machine.ts), esto solo cambia qué se
    // muestra en pantalla.
    db.booking.findMany({
      where: {
        venueId,
        date: { gte: start, lt: end },
        status: { in: [BookingStatus.CONFIRMADA, BookingStatus.EN_CURSO] },
      },
      select: { startTime: true },
    }),
    db.slotBlock.findMany({
      where: { venueId, date: { gte: start, lt: end } },
      select: { startTime: true },
    }),
  ]);

  const takenStarts = new Set(blockingBookings.map((booking) => booking.startTime));
  const maintenanceStarts = new Set(maintenanceBlocks.map((block) => block.startTime));

  const slots: HourSlot[] = [];
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour++) {
    const startTime = formatHour(hour);
    const isMaintenance = maintenanceStarts.has(startTime);
    const isTaken = takenStarts.has(startTime);
    slots.push({
      startTime,
      endTime: formatHour(hour + 1),
      available: !isTaken && !isMaintenance,
      blockedReason: isMaintenance ? "mantenimiento" : isTaken ? "reservado" : undefined,
    });
  }

  return slots;
}

// Para las tarjetas de "próximo horario libre" del listado de canchas.
export async function getNextAvailableSlot(venueId: string): Promise<{ dateIso: string; startTime: string } | null> {
  const today = todayBusinessDate();

  for (let i = 0; i < 14; i++) {
    const dateIso = i === 0 ? today : addBusinessDays(today, i);
    const slots = await getDaySlots(venueId, dateIso);
    const next = slots.find((slot) => slot.available);
    if (next) {
      return { dateIso, startTime: next.startTime };
    }
  }

  return null;
}
