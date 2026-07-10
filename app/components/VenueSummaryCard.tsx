import { getVenuePhotos } from "@/lib/venues/photos";

const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_8: "Fútbol 8",
  PADEL: "Pádel",
};

const VENUE_TYPE_ICON: Record<string, string> = {
  FUTBOL_5: "⚽",
  FUTBOL_8: "⚽",
  PADEL: "🎾",
};

// Tarjeta de cancha con foto/badge/fecha-hora-precio, compartida entre el flujo de reserva
// (/[venueId]/reservar) y la página de confirmación (/reserva/[bookingId]) para que se vean iguales.
export function VenueSummaryCard({
  venue,
  weekday,
  day,
  month,
  startTime,
  endTime,
  mapsLink,
}: {
  venue: {
    name: string;
    type: string;
    hourlyRate: number;
    imageUrl: string | null;
    imageUrls?: string[];
    capacity?: number | null;
  };
  weekday: string;
  day: string;
  month: string;
  startTime: string;
  endTime: string;
  mapsLink?: string;
}) {
  const [coverPhoto] = getVenuePhotos(venue);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex h-36 items-center justify-center bg-gray-100">
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto externa arbitraria pegada por el admin
          <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</span>
        )}
      </div>

      <div className="p-4">
        <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium tracking-wide text-emerald-700 uppercase">
          {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
        </span>
        <div className="mt-2 text-lg font-semibold text-gray-900">{venue.name}</div>

        <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 text-sm text-gray-700">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span>📅</span>
              {weekday} {day} de {month}
            </span>
            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-xs font-medium text-emerald-700 underline"
              >
                📍 Ver ubicación
              </a>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-shrink-0 items-center gap-2">
              <span>🕐</span>
              {startTime} - {endTime}
            </span>
            <span className="flex-shrink-0 text-right">
              <span className="text-lg font-semibold text-emerald-700">
                ${venue.hourlyRate.toLocaleString("es-CO")}
              </span>
              <span className="ml-1 text-xs text-gray-500">/hora</span>
            </span>
          </div>
          {Boolean(venue.capacity) && (
            <div className="flex items-center gap-2">
              <span>👥</span>
              {venue.capacity} jugadores
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
