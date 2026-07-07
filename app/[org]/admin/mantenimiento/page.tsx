import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDaySlots, parseDateParam, todayIso } from "@/lib/booking/availability";
import { addBusinessDays, businessDayRange } from "@/lib/time/business-day";
import { blockSlot, unblockSlot } from "@/lib/admin/actions";

const ERROR_MESSAGES: Record<string, string> = {
  horario_ocupado: "Ese horario ya tiene una reserva real, no se puede bloquear por mantenimiento.",
};

export default async function MantenimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ venueId?: string; date?: string; error?: string }>;
}) {
  const { org: orgSlug } = await params;
  const { venueId: venueIdParam, date: dateParam, error } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });
  const venue = venues.find((v) => v.id === venueIdParam) ?? venues[0];
  const dateIso = parseDateParam(dateParam);

  if (!venue) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold">Mantenimiento</h1>
        <p className="mt-4 text-sm text-gray-500">Crea una cancha primero en la sección Canchas.</p>
      </main>
    );
  }

  const slots = await getDaySlots(venue.id, dateIso);
  const { start, end } = businessDayRange(dateIso);
  const blocks = await db.slotBlock.findMany({ where: { venueId: venue.id, date: { gte: start, lt: end } } });
  const blockByStart = new Map(blocks.map((b) => [b.startTime, b]));

  const prevDateIso = addBusinessDays(dateIso, -1);
  const nextDateIso = addBusinessDays(dateIso, 1);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Mantenimiento</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bloquea un horario cuando la cancha no se puede usar (luces, cancha en reparación, etc.) sin
        que exista una reserva.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {venues.map((v) => (
          <Link
            key={v.id}
            href={`/${orgSlug}/admin/mantenimiento?venueId=${v.id}&date=${dateIso}`}
            className={`rounded-md border px-3 py-2.5 text-sm ${
              v.id === venue.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700"
            }`}
          >
            {v.name}
          </Link>
        ))}
      </div>

      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{ERROR_MESSAGES[error]}</p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={`/${orgSlug}/admin/mantenimiento?venueId=${venue.id}&date=${prevDateIso}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← Día anterior
        </Link>
        <span className="font-medium">{dateIso}</span>
        <Link
          href={`/${orgSlug}/admin/mantenimiento?venueId=${venue.id}&date=${nextDateIso}`}
          className="text-sm text-gray-500 hover:underline"
        >
          Día siguiente →
        </Link>
      </div>

      <ul className="mt-6 grid gap-2">
        {slots.map((slot) => {
          const block = blockByStart.get(slot.startTime);

          return (
            <li
              key={slot.startTime}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
            >
              <span className="w-14 font-medium">{slot.startTime}</span>

              {slot.blockedReason === "reservado" && (
                <span className="text-sm text-gray-400">Reservado por un cliente</span>
              )}

              {block && (
                <>
                  <span className="flex-1 text-sm text-amber-700">
                    En mantenimiento{block.reason ? ` — ${block.reason}` : ""}
                  </span>
                  <form action={unblockSlot}>
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="slotBlockId" value={block.id} />
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="date" value={dateIso} />
                    <button type="submit" className="rounded-md bg-gray-900 px-3 py-2.5 text-sm text-white">
                      Desbloquear
                    </button>
                  </form>
                </>
              )}

              {!block && slot.blockedReason !== "reservado" && (
                <form action={blockSlot} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input type="hidden" name="venueId" value={venue.id} />
                  <input type="hidden" name="date" value={dateIso} />
                  <input type="hidden" name="startTime" value={slot.startTime} />
                  <input
                    name="reason"
                    placeholder="Motivo (opcional)"
                    className="flex-1 rounded-md border border-gray-300 px-2 py-2.5 text-sm"
                  />
                  <button type="submit" className="rounded-md bg-amber-600 px-3 py-2.5 text-sm text-white">
                    Bloquear
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {dateIso === todayIso() && <p className="mt-4 text-xs text-gray-400">Hoy</p>}
    </main>
  );
}
