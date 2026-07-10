import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDaySlots, parseDateParam, todayIso } from "@/lib/booking/availability";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { getOrgMapEmbedSrc, getOrgMapsLink } from "@/lib/org/maps";
import { getVenuePhotos } from "@/lib/venues/photos";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL, VENUE_TYPE_SERVICES, VENUE_TYPE_SURFACE } from "@/lib/venues/type-info";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { BackButton } from "./BackButton";
import { DaySelector } from "./DaySelector";
import { DateJumpInput } from "./DateJumpInput";
import { VenueGallery } from "./VenueGallery";
import { Footer } from "@/app/components/Footer";

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; venueId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { org: orgSlug, venueId } = await params;
  const { date: dateParam } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== organization.id) {
    notFound();
  }

  const dateIso = parseDateParam(dateParam);
  const slots = await getDaySlots(venue.id, dateIso);
  const { weekday, day, month } = formatBusinessDayLabel(dateIso);
  const photos = getVenuePhotos(venue);
  const services = VENUE_TYPE_SERVICES[venue.type] ?? [];
  const surfaceLabel = VENUE_TYPE_SURFACE[venue.type];
  const hasService = (keyword: string) => services.some((s) => s.label.toLowerCase().includes(keyword));

  // Texto generado a partir de datos reales (tipo, superficie, servicios de referencia por tipo de
  // cancha) en vez de una descripción fija por cancha — ese campo no existe todavía en el modelo.
  const description = `Cancha ${surfaceLabel ? surfaceLabel.toLowerCase() : "deportiva"} profesional, ideal para partidos de ${
    VENUE_TYPE_LABEL[venue.type] ?? venue.type
  }.${services.length > 0 ? ` Cuenta con ${services.map((s) => s.label.toLowerCase()).join(", ")}.` : ""}`;

  const specs = [
    { icon: "⚽", label: "Deporte", value: VENUE_TYPE_LABEL[venue.type] ?? venue.type },
    ...(surfaceLabel ? [{ icon: "▱", label: "Superficie", value: surfaceLabel }] : []),
    { icon: "💡", label: "Iluminación", value: hasService("iluminación") ? "Sí" : "No" },
    { icon: "🅿️", label: "Estacionamiento", value: hasService("parqueadero") ? "Sí" : "No" },
  ];

  const orgLocationLabel =
    [organization.municipality, organization.department].filter(Boolean).join(", ") || organization.country;
  const mapEmbedSrc = getOrgMapEmbedSrc(organization);
  const mapsLink = getOrgMapsLink(organization);

  return (
    <>
      <main className="pb-10 lg:mx-auto lg:max-w-6xl lg:px-10 lg:pt-8">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-8">
          <div className="relative bg-gray-100 lg:overflow-hidden lg:rounded-2xl">
            {photos.length > 0 ? (
              <VenueGallery photos={photos} alt={venue.name} />
            ) : (
              <div className="flex h-48 items-center justify-center">
                <span className="text-6xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</span>
              </div>
            )}
            <BackButton fallbackHref={`/${orgSlug}`} />
            <div className="absolute left-3 top-14 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700">
                {VENUE_TYPE_ICON[venue.type] ?? "🏟️"} {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
              </span>
              {VENUE_TYPE_SURFACE[venue.type] && (
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {VENUE_TYPE_SURFACE[venue.type]}
                </span>
              )}
            </div>
            <span className="absolute right-3 top-3 rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white shadow">
              ${venue.hourlyRate.toLocaleString("es-CO")}/h
            </span>
          </div>

          <div className="px-4 pt-4 lg:px-0">
            <h1 className="text-2xl font-semibold text-gray-900">{venue.name}</h1>

            <p className="mt-1.5 text-sm text-gray-500">
              📍 {orgLocationLabel} • A 1,2 km
            </p>

            {services && services.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
                {services.map((service) => (
                  <span key={service.label} className="flex items-center gap-1">
                    <span aria-hidden="true">{service.icon}</span> {service.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pt-4 lg:px-0 lg:pt-0">
          <div className="mt-6 flex justify-end lg:mt-0">
            <DateJumpInput orgSlug={orgSlug} venueId={venue.id} selectedDateIso={dateIso} />
          </div>

          <div className="mt-2">
            <DaySelector basePath={`/${orgSlug}/${venue.id}`} selectedDateIso={dateIso} />
          </div>

          <p className="mt-4 text-sm font-medium text-gray-700">
            {weekday} {day} de {month}
          </p>

          <AvailabilityGrid
            orgSlug={orgSlug}
            venueId={venue.id}
            dateIso={dateIso}
            hourlyRate={venue.hourlyRate}
            initialSlots={slots}
          />

          {dateIso === todayIso() && (
            <p className="mt-4 text-xs text-gray-500">● en vivo — se actualiza solo cada pocos segundos</p>
          )}
        </div>
      </div>

      <div className="mt-10 border-t border-gray-100 px-4 pt-8 lg:px-0">
        <h2 className="text-lg font-semibold text-gray-900">Información de la cancha</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>

        <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
          {specs.map((spec) => (
            <div key={spec.label} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-5 text-center text-gray-500" aria-hidden="true">
                {spec.icon}
              </span>
              <span className="font-medium text-gray-700">{spec.label}</span>
              <span className="ml-auto font-semibold text-gray-900">{spec.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 border-t border-gray-100 px-4 pt-8 pb-2 lg:px-0">
        <h2 className="text-lg font-semibold text-gray-900">Ubicación</h2>

        {mapEmbedSrc && (
          <div className="mt-4 h-40 overflow-hidden rounded-2xl border border-gray-200">
            <iframe src={mapEmbedSrc} className="h-full w-full" loading="lazy" title="Ubicación de la cancha" />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">{orgLocationLabel}</p>
            <p className="mt-0.5 text-xs text-gray-500">A 1,2 km de tu ubicación</p>
          </div>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cómo llegar"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-700"
            >
              →
            </a>
          )}
        </div>
      </div>
      </main>
      <Footer />
    </>
  );
}
