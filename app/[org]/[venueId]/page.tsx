import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDaySlots, parseDateParam, todayIso } from "@/lib/booking/availability";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { DaySelector } from "./DaySelector";
import { DateJumpInput } from "./DateJumpInput";

const VENUE_TYPE_ICON: Record<string, string> = {
  FUTBOL_5: "⚽",
  FUTBOL_8: "⚽",
  PADEL: "🎾",
};

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

  return (
    <main className="mx-auto max-w-2xl pb-10">
      <div className="relative flex h-40 items-center justify-center bg-gray-100">
        {venue.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto externa arbitraria pegada por el admin
          <img src={venue.imageUrl} alt={venue.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-6xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</span>
        )}
        <Link
          href={`/${orgSlug}`}
          className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700"
        >
          ←
        </Link>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{venue.name}</h1>
          <span className="text-sm font-medium text-gray-500">
            ${venue.hourlyRate.toLocaleString("es-CO")}/h
          </span>
        </div>

        <div className="mt-6 flex justify-end">
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
          <p className="mt-4 text-xs text-gray-400">● en vivo — se actualiza solo cada pocos segundos</p>
        )}
      </div>
    </main>
  );
}
