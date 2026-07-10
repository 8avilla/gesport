// Cancha Libre opera únicamente en Colombia (America/Bogota, UTC-5 fijo, sin horario de verano). Un
// offset constante alcanza; si algún día se opera en una zona con DST, esto necesita una librería
// de zonas horarias real (Intl o dayjs+timezone) en vez de un offset fijo.
const BUSINESS_UTC_OFFSET = "-05:00";
const BUSINESS_UTC_OFFSET_HOURS = 5;

export function businessDateFromInstant(instant: Date): string {
  const bogotaInstant = new Date(instant.getTime() - BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return bogotaInstant.toISOString().slice(0, 10);
}

export function todayBusinessDate(): string {
  return businessDateFromInstant(new Date());
}

export function businessDayStart(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
}

export function businessDayRange(dateIso: string): { start: Date; end: Date } {
  const start = businessDayStart(dateIso);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function addBusinessDays(dateIso: string, delta: number): string {
  const date = businessDayStart(dateIso);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "America/Bogota" });
const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat("es-CO", { day: "numeric", timeZone: "America/Bogota" });
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "America/Bogota" });

export function formatBusinessDayLabel(dateIso: string): { weekday: string; day: string; month: string } {
  const date = businessDayStart(dateIso);
  return {
    weekday: WEEKDAY_FORMATTER.format(date).replace(".", ""),
    day: DAY_NUMBER_FORMATTER.format(date),
    month: MONTH_FORMATTER.format(date).replace(".", ""),
  };
}
