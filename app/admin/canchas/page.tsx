import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createVenue, updateVenue } from "@/lib/admin/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { getVenuePhotos } from "@/lib/venues/photos";

const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_8: "Fútbol 8",
  PADEL: "Pádel",
};

export default async function CanchasPage() {
  const { orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Canchas y tarifas</h1>

      <ul className="mt-6 grid gap-3">
        {venues.map((venue) => (
          <li key={venue.id} className="rounded-lg border border-gray-200 p-4">
            <div className="font-medium">
              {venue.name} <span className="text-sm text-gray-500">({VENUE_TYPE_LABEL[venue.type]})</span>
            </div>
            <form action={updateVenue} className="mt-2 flex flex-wrap items-end gap-3">
              <input type="hidden" name="venueId" value={venue.id} />
              <label className="grid min-w-52 flex-1 gap-1 text-sm">
                URLs de fotos (una por línea, opcional)
                <textarea
                  name="imageUrls"
                  rows={3}
                  defaultValue={getVenuePhotos(venue).join("\n")}
                  placeholder="https://…"
                  className="rounded-md border border-gray-300 px-3 py-3 font-mono text-xs"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Tarifa/hora
                <input
                  type="number"
                  inputMode="numeric"
                  name="hourlyRate"
                  min={0}
                  defaultValue={venue.hourlyRate}
                  className="rounded-md border border-gray-300 px-3 py-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Jugadores (opcional)
                <input
                  type="number"
                  inputMode="numeric"
                  name="capacity"
                  min={0}
                  defaultValue={venue.capacity ?? ""}
                  placeholder="Ej: 10"
                  className="w-24 rounded-md border border-gray-300 px-3 py-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Estado
                <select
                  name="active"
                  defaultValue={venue.active ? "true" : "false"}
                  className="rounded-md border border-gray-300 px-3 py-3"
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </label>
              <button type="submit" className="rounded-md bg-gray-900 px-3 py-3 text-sm text-white">
                Guardar
              </button>
            </form>
          </li>
        ))}

        {venues.length === 0 && <li className="text-sm text-gray-500">Sin canchas todavía.</li>}
      </ul>

      <form action={createVenue} className="mt-8 grid gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium">Nueva cancha</h2>
        <label className="grid gap-1 text-sm">
          Nombre
          <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Tipo
          <select name="type" required className="rounded-md border border-gray-300 px-3 py-3">
            <option value="FUTBOL_5">Fútbol 5</option>
            <option value="FUTBOL_8">Fútbol 8</option>
            <option value="PADEL">Pádel</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tarifa por hora
          <input
            type="number"
            inputMode="numeric"
            name="hourlyRate"
            min={0}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <button type="submit" className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
          Crear cancha
        </button>
      </form>
    </main>
  );
}
