"use client";

import { useRouter } from "next/navigation";

// Selector de fecha nativo (input type=date) para saltar directo a un día lejano — la franja de 14
// días de DaySelector es rápida para "esta semana o la próxima", pero no alcanza para reservar con
// un mes de anticipación. En móvil, un <input type="date"> abre el calendario nativo del sistema
// (mucho mejor que armar uno propio a mano).
export function DateJumpInput({
  orgSlug,
  venueId,
  selectedDateIso,
}: {
  orgSlug: string;
  venueId: string;
  selectedDateIso: string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span>📅</span>
      <input
        type="date"
        defaultValue={selectedDateIso}
        onChange={(e) => {
          if (e.target.value) {
            router.push(`/${orgSlug}/${venueId}?date=${e.target.value}`);
          }
        }}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700"
        aria-label="Ir a una fecha específica"
      />
    </label>
  );
}
