import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { getVenuePhotos } from "@/lib/venues/photos";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import { NuevaCanchaDrawer } from "./NuevaCanchaDrawer";

const ERROR_MESSAGES: Record<string, string> = {
  foto_formato_invalido: "Formato de foto no soportado. Usa PNG, JPG o WEBP.",
  foto_muy_grande: "Cada foto debe pesar máximo 5 MB.",
  demasiadas_fotos: "Máximo 8 fotos por cancha.",
};

const STATUS_LABEL: Record<string, string> = { ACTIVA: "Activa", MANTENIMIENTO: "Mantenimiento", INACTIVA: "Inactiva" };
const STATUS_BADGE: Record<string, string> = {
  ACTIVA: "bg-emerald-600 text-white",
  MANTENIMIENTO: "bg-amber-600 text-white",
  INACTIVA: "bg-gray-700 text-white",
};

const SORT_OPTIONS = [
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "precio_asc", label: "Tarifa (menor a mayor)" },
  { value: "precio_desc", label: "Tarifa (mayor a menor)" },
] as const;

export default async function CanchasPage({
  searchParams,
}: {
  searchParams: Promise<{
    actualizado?: string;
    creada?: string;
    error?: string;
    q?: string;
    type?: string;
    status?: string;
    sort?: string;
    nueva?: string;
  }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { actualizado, creada, error, q, type, status, sort, nueva } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  // "Combina con" es de doble vía: si A lista a B en linkedVenueIds, a B le mostramos "Combina con:
  // A" de solo lectura. No tiene nada que ver con VenueType: cualquier cancha se puede combinar con
  // cualquier otra.
  const referencedBy = new Map<string, string[]>();
  for (const venue of venues) {
    for (const linkedId of venue.linkedVenueIds) {
      referencedBy.set(linkedId, [...(referencedBy.get(linkedId) ?? []), venue.name]);
    }
  }

  const query = q?.trim().toLowerCase() ?? "";
  const typeFilter = type && type in VENUE_TYPE_LABEL ? type : "";
  const statusFilter = status && status in STATUS_LABEL ? status : "";
  const activeSort = SORT_OPTIONS.find((s) => s.value === sort)?.value ?? "nombre";

  const filteredVenues = venues
    .filter((v) => !query || v.name.toLowerCase().includes(query))
    .filter((v) => !typeFilter || v.type === typeFilter)
    .filter((v) => !statusFilter || v.status === statusFilter)
    .sort((a, b) => {
      if (activeSort === "precio_asc") return a.hourlyRate - b.hourlyRate;
      if (activeSort === "precio_desc") return b.hourlyRate - a.hourlyRate;
      return a.name.localeCompare(b.name);
    });

  const hasActiveFilters = Boolean(query || typeFilter || statusFilter || sort);

  // Preserva los filtros activos al abrir/cerrar el drawer de "Nueva cancha".
  const filterQuery = new URLSearchParams();
  if (q) filterQuery.set("q", q);
  if (typeFilter) filterQuery.set("type", typeFilter);
  if (statusFilter) filterQuery.set("status", statusFilter);
  if (sort) filterQuery.set("sort", sort);
  const closeDrawerHref = `/admin/canchas${filterQuery.toString() ? `?${filterQuery}` : ""}`;
  filterQuery.set("nueva", "1");
  const drawerHref = `/admin/canchas?${filterQuery}`;

  return (
    <main className="px-6 py-10">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Canchas</h1>
          <p className="mt-1 text-sm text-gray-500">Administra tus canchas, horarios y tarifas.</p>
        </div>
        <Link
          href={drawerHref}
          className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-center text-sm font-medium text-white
            hover:bg-emerald-800 sm:w-auto"
        >
          + Nueva cancha
        </Link>
      </div>

      {actualizado && <div className="mt-4"><Banner type="success" message="Cancha actualizada correctamente." /></div>}
      {creada && <div className="mt-4"><Banner type="success" message="Cancha creada correctamente." /></div>}
      {error && ERROR_MESSAGES[error] && <div className="mt-4"><Banner type="error" message={ERROR_MESSAGES[error]} /></div>}

      <form method="get" className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar cancha…"
            className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>

        {/* En mobile, Tipo/Estado/Ordenar/Filtrar quedan detrás de este botón (checkbox-only toggle,
            sin JS); en desktop siempre están visibles — ver peer-checked/sm: en los divs de abajo. */}
        <input type="checkbox" id="canchas-filtros-toggle" className="peer sr-only" />
        <label
          htmlFor="canchas-filtros-toggle"
          className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300
            bg-white px-4 py-2.5 text-sm font-medium text-gray-700 sm:hidden"
        >
          🔽 Filtros
        </label>

        <div className="hidden gap-3 peer-checked:mt-3 peer-checked:grid sm:mt-3 sm:grid sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Tipo</label>
            <select name="type" defaultValue={typeFilter} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
              <option value="">Todos</option>
              {Object.entries(VENUE_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Estado</label>
            <select name="status" defaultValue={statusFilter} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Ordenar por</label>
            <select name="sort" defaultValue={activeSort} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden items-center gap-3 peer-checked:mt-3 peer-checked:flex sm:mt-3 sm:flex">
          <SubmitButton pendingLabel="Filtrando…" className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">
            Filtrar
          </SubmitButton>
          {hasActiveFilters && (
            <Link href="/admin/canchas" className="text-sm text-gray-500 underline">
              Limpiar filtros
            </Link>
          )}
          <span className="ml-auto self-center text-sm text-gray-500">
            {filteredVenues.length} {filteredVenues.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </form>

      <h2 className="mt-6 text-sm font-semibold text-gray-900">Canchas ({filteredVenues.length})</h2>

      <ul className="mt-3 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {filteredVenues.map((venue) => {
          const [coverPhoto] = getVenuePhotos(venue);
          const combinedWith = referencedBy.get(venue.id);

          return (
            <li key={venue.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <Link href={`/admin/canchas/${venue.id}`} className="block">
                <div className="relative h-36 bg-gradient-to-br from-emerald-700 to-emerald-950">
                  {coverPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto subida a Azure Blob por el admin
                    <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-gray-800">
                    {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
                  </span>
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[venue.status]}`}>
                    {STATUS_LABEL[venue.status]}
                  </span>
                </div>

                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{venue.name}</h2>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xl font-bold text-emerald-700">${venue.hourlyRate.toLocaleString("es-CO")}</div>
                      <div className="text-xs text-gray-500">por hora</div>
                    </div>
                  </div>
                  {venue.capacity && <p className="mt-0.5 text-xs text-gray-500">👥 {venue.capacity} jugadores</p>}
                  {combinedWith && <p className="mt-1 text-xs text-gray-500">🔗 Combina con: {combinedWith.join(", ")}</p>}
                </div>
              </Link>

              <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
                <Link
                  href={`/admin/canchas/${venue.id}?editar=1`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ✏️ Editar
                </Link>
                <Link
                  href={`/admin/canchas/${venue.id}?tab=fotos`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  🖼️ Fotos
                </Link>
                <Link
                  href={`/admin/canchas/${venue.id}?tab=horarios`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  🕐 Horarios
                </Link>
              </div>
            </li>
          );
        })}

        {filteredVenues.length === 0 && venues.length > 0 && (
          <li className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 lg:col-span-2 xl:col-span-3">
            <div className="text-3xl">🔍</div>
            <p className="mt-2">Sin canchas para estos filtros.</p>
          </li>
        )}

        {!hasActiveFilters && (
          <li>
            <Link
              href={drawerHref}
              className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2
                border-dashed border-gray-200 p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                +
              </span>
              <span className="text-sm font-semibold text-gray-900">Nueva cancha</span>
              <span className="text-xs text-gray-500">Agrega una nueva cancha y configura sus horarios y tarifas.</span>
            </Link>
          </li>
        )}
      </ul>

      {nueva === "1" && <NuevaCanchaDrawer closeHref={closeDrawerHref} />}
    </main>
  );
}
