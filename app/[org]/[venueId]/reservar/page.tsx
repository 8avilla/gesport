import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { getOrgMapsLink } from "@/lib/org/maps";
import { VenueSummaryCard } from "@/app/components/VenueSummaryCard";
import { BackButton } from "../BackButton";
import { ReservarForm } from "./ReservarForm";

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; venueId: string }>;
  searchParams: Promise<{ date?: string; start?: string; end?: string }>;
}) {
  const { org: orgSlug, venueId } = await params;
  const { date, start, end } = await searchParams;

  if (!date || !start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== organization.id) {
    notFound();
  }

  const { weekday, day, month } = formatBusinessDayLabel(date);

  return (
    <main className="mx-auto max-w-md px-4 py-6 lg:max-w-4xl">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center lg:grid-cols-[2.5rem_1fr]">
        <BackButton
          fallbackHref={`/${orgSlug}/${venue.id}?date=${date}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
        />
        <h1 className="text-center text-lg font-semibold text-gray-900 lg:text-left lg:text-xl">
          Confirma tu reserva
        </h1>
      </div>

      <div className="lg:mt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="mt-4 lg:sticky lg:top-8 lg:mt-0">
          <VenueSummaryCard
            venue={venue}
            weekday={weekday}
            day={day}
            month={month}
            startTime={start}
            endTime={end}
            mapsLink={getOrgMapsLink(organization)}
          />
        </div>

        <ReservarForm
          orgSlug={orgSlug}
          venueId={venue.id}
          date={date}
          start={start}
          end={end}
          cancellationWindowHours={organization.cancellationWindowHours}
        />
      </div>
    </main>
  );
}
