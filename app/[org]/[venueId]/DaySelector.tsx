import Link from "next/link";
import { addBusinessDays, formatBusinessDayLabel, todayBusinessDate } from "@/lib/time/business-day";

const DAYS_AHEAD = 14;

// Franja horizontal de días (hoy + 13 siguientes) en vez de links de texto "día anterior/siguiente"
// — permite saltar directo a cualquier día sin navegar de a uno, y se ve el día de la semana de un
// vistazo (útil para decidir "el sábado" sin tener que contar).
export function DaySelector({
  basePath,
  selectedDateIso,
}: {
  basePath: string;
  selectedDateIso: string;
}) {
  const today = todayBusinessDate();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addBusinessDays(today, i));

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Elegir fecha">
      {days.map((dateIso) => {
        const isSelected = dateIso === selectedDateIso;
        const isToday = dateIso === today;
        const { weekday, day } = formatBusinessDayLabel(dateIso);

        return (
          <Link
            key={dateIso}
            href={`${basePath}?date=${dateIso}`}
            role="tab"
            aria-selected={isSelected}
            className={`flex min-w-14 flex-shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-center transition-colors ${
              isSelected
                ? "border-emerald-600 bg-emerald-700 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300"
            }`}
          >
            <span className={`text-[11px] uppercase ${isSelected ? "text-emerald-100" : "text-gray-400"}`}>
              {isToday ? "Hoy" : weekday}
            </span>
            <span className="text-base font-semibold">{day}</span>
          </Link>
        );
      })}
    </div>
  );
}
