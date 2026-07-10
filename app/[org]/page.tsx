import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getNextAvailableSlot } from "@/lib/booking/availability";
import { todayBusinessDate } from "@/lib/time/business-day";
import { getVenuePhotos } from "@/lib/venues/photos";
import { getOrgMapEmbedSrc, getOrgMapsLink } from "@/lib/org/maps";
import { Footer } from "@/app/components/Footer";

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

export default async function OrganizationPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({
    where: { orgId: organization.id, active: true },
    orderBy: { name: "asc" },
  });

  const today = todayBusinessDate();
  const nextSlots = await Promise.all(venues.map((venue) => getNextAvailableSlot(venue.id)));
  const mapsLink = getOrgMapsLink(organization);
  const mapEmbedSrc = getOrgMapEmbedSrc(organization);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-10 lg:max-w-none lg:px-10 xl:px-16">
      <div className="border-b border-gray-100 bg-gradient-to-b from-emerald-50 to-white px-4 pt-8 pb-6 -mx-4 lg:-mx-10 lg:px-10 xl:-mx-16 xl:px-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido por el admin como URL externa
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-lg font-semibold text-white">
              {organization.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-gray-900">{organization.name}</span>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700"
            >
              📍 Cómo llegar
            </a>
          )}
        </div>

        <h1 className="mt-4 text-2xl font-semibold leading-tight text-gray-900">
          Reserva tu próxima cancha
          <br />
          <span className="text-emerald-700">en menos de 1 minuto</span>
        </h1>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>⏱️ Disponibilidad en tiempo real</span>
          <span>🔒 Pago seguro con Bold</span>
          <span>✅ Confirmación inmediata</span>
        </div>

        {mapEmbedSrc && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="relative mt-4 block h-28 overflow-hidden rounded-lg border border-gray-200"
          >
            <iframe
              src={mapEmbedSrc}
              className="pointer-events-none h-full w-full"
              loading="lazy"
              title="Ubicación del complejo"
            />
            <span className="absolute bottom-2 right-2 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 shadow">
              Ver en el mapa
            </span>
            </a>
          )}
        </div>
      </div>

      <h2 className="mt-6 text-sm font-medium text-gray-700">Elige una cancha</h2>

      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {venues.map((venue, index) => {
          const nextSlot = nextSlots[index];
          const isNextSlotToday = nextSlot?.dateIso === today;
          const [coverPhoto] = getVenuePhotos(venue);

          return (
            <li key={venue.id} className="overflow-hidden rounded-xl border border-gray-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <Link href={`/${organization.slug}/${venue.id}`} className="group block">
                <div className="relative flex h-36 items-center justify-center bg-gray-100">
                  {coverPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- fotos de canchas vienen de URLs externas arbitrarias que pega el admin
                    <img src={coverPhoto} alt={venue.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-5xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</span>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-gray-900">{venue.name}</span>
                    <div className="flex-shrink-0 text-right">
                      <div className="font-semibold text-gray-900">
                        ${venue.hourlyRate.toLocaleString("es-CO")}
                      </div>
                      <div className="text-xs text-gray-500">/ hora</div>
                    </div>
                  </div>

                  {nextSlot && (
                    <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Próximo horario libre: {isNextSlotToday ? "Hoy" : nextSlot.dateIso} {nextSlot.startTime}
                    </span>
                  )}

                  <span className="mt-3 flex items-center justify-center gap-1 rounded-md bg-emerald-700 py-2 text-sm font-medium text-white transition-colors group-hover:bg-emerald-800">
                    Ver horarios →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}

        {venues.length === 0 && (
          <li className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 sm:col-span-2 lg:col-span-full">
            <div className="text-2xl">🏗️</div>
            <p className="mt-2">Todavía no hay canchas configuradas aquí.</p>
            <p className="text-gray-500">Vuelve pronto 👋</p>
          </li>
        )}
      </ul>
      </main>
      <Footer />
    </>
  );
}
