import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Venue } from "@/lib/generated/prisma";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { getVenuePhotos } from "@/lib/venues/photos";
import { getVenueStats30d } from "@/lib/admin/queries";
import { createVenuePriceRule, deleteVenuePriceRule, setVenueStatus, updateVenue } from "@/lib/admin/actions";
import { OPENING_HOUR, CLOSING_HOUR } from "@/lib/booking/availability";
import { DAY_OF_WEEK_LABEL } from "@/lib/booking/pricing";
import { businessDayRange, todayBusinessDate } from "@/lib/time/business-day";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL } from "@/lib/venues/type-info";
import {
  VENUE_AMENITIES,
  VENUE_AMENITY_ICON,
  VENUE_AMENITY_LABEL,
  VENUE_COVERAGE_OPTIONS,
  VENUE_SURFACE_OPTIONS,
} from "@/lib/venues/amenities";
import { Banner } from "@/app/admin/Banner";
import { SubmitButton } from "@/app/components/SubmitButton";

const STATUS_LABEL: Record<string, string> = { ACTIVA: "Activa", MANTENIMIENTO: "Mantenimiento", INACTIVA: "Inactiva" };
const STATUS_BADGE: Record<string, string> = {
  ACTIVA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  MANTENIMIENTO: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  INACTIVA: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
};

const ERROR_MESSAGES: Record<string, string> = {
  foto_formato_invalido: "Formato de foto no soportado. Usa PNG, JPG o WEBP.",
  foto_muy_grande: "Cada foto debe pesar máximo 5 MB.",
  demasiadas_fotos: "Máximo 8 fotos por cancha.",
  precio_rango_invalido: "El rango de horas de la excepción no es válido.",
  precio_solapado: "Ese horario se solapa con otra excepción de precio ya guardada para ese día.",
};

const HOUR_OPTIONS = Array.from({ length: CLOSING_HOUR - OPENING_HOUR + 1 }, (_, i) =>
  `${String(OPENING_HOUR + i).padStart(2, "0")}:00`,
);

const TABS = [
  { key: "general", label: "Información general" },
  { key: "fotos", label: "Fotos" },
  { key: "horarios", label: "Horarios" },
  { key: "precios", label: "Precios" },
  { key: "relacionadas", label: "Canchas relacionadas" },
  { key: "reservas", label: "Reservas" },
  { key: "mantenimiento", label: "Mantenimiento" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// La pestaña de Fotos solo expone controles de foto, pero updateVenue es una sola acción
// monolítica — este form reenvía el resto de campos como hidden con el valor actual para no
// perderlos al guardar.
function PreserveVenueFields({ venue }: { venue: Venue }) {
  return (
    <>
      <input type="hidden" name="hourlyRate" value={venue.hourlyRate} />
      <input type="hidden" name="capacity" value={venue.capacity ?? ""} />
      <input type="hidden" name="status" value={venue.status} />
      <input type="hidden" name="requiresPayment" value={venue.requiresPayment ? "true" : "false"} />
      {venue.linkedVenueIds.map((id) => (
        <input key={id} type="hidden" name="linkedVenueIds" value={id} />
      ))}
      {venue.amenities.map((slug) => (
        <input key={slug} type="hidden" name="amenities" value={slug} />
      ))}
      {venue.surface && <input type="hidden" name="surface" value={venue.surface} />}
      {venue.coverage && <input type="hidden" name="coverage" value={venue.coverage} />}
      {venue.locationInComplex && <input type="hidden" name="locationInComplex" value={venue.locationInComplex} />}
      {venue.description && <input type="hidden" name="description" value={venue.description} />}
    </>
  );
}

export default async function VenueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ tab?: string; editar?: string; actualizado?: string; error?: string }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { venueId } = await params;
  const { tab: tabParam, editar, actualizado, error } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venue = await db.venue.findUnique({ where: { id: venueId }, include: { priceRules: true } });
  if (!venue || venue.orgId !== organization.id) {
    notFound();
  }

  const sortedPriceRules = [...venue.priceRules].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
  );

  const allVenues = await db.venue.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });
  const activeTab: TabKey = TABS.find((t) => t.key === tabParam)?.key ?? "general";
  const isEditing = editar === "1";

  const photos = getVenuePhotos(venue);
  const shortId = venue.id.slice(-6).toUpperCase();
  const linkedVenues = allVenues.filter((v) => venue.linkedVenueIds.includes(v.id));
  const referencingVenues = allVenues.filter((v) => v.linkedVenueIds.includes(venue.id));
  const otherVenues = allVenues.filter((v) => v.id !== venue.id);

  const stats = activeTab === "general" ? await getVenueStats30d(venue.id) : null;

  const recentBookings =
    activeTab === "reservas"
      ? await db.booking.findMany({
          where: { venueId: venue.id },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          take: 10,
        })
      : [];

  const upcomingBlocks =
    activeTab === "horarios" || activeTab === "mantenimiento"
      ? await db.slotBlock.findMany({
          where: { venueId: venue.id, date: { gte: businessDayRange(todayBusinessDate()).start } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 20,
        })
      : [];

  const tabHref = (tab: TabKey) => `/admin/canchas/${venue.id}?tab=${tab}`;
  const editHref = `/admin/canchas/${venue.id}?tab=${activeTab}&editar=1`;
  const closeEditHref = `/admin/canchas/${venue.id}?tab=${activeTab}`;

  return (
    <main className="px-6 py-10">
      <Link href="/admin/canchas" className="text-sm text-gray-500 hover:underline">
        ← Volver a canchas
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{venue.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[venue.status]}`}>
              {STATUS_LABEL[venue.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {VENUE_TYPE_ICON[venue.type] ?? "🏟️"} {VENUE_TYPE_LABEL[venue.type] ?? venue.type}
            {venue.capacity ? ` · 👥 ${venue.capacity} jugadores` : ""} · CAN-{shortId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 [&::-webkit-details-marker]:hidden">
              Más acciones <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg">
              {(["ACTIVA", "MANTENIMIENTO", "INACTIVA"] as const)
                .filter((s) => s !== venue.status)
                .map((s) => (
                  <form key={s} action={setVenueStatus}>
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input type="hidden" name="status" value={s} />
                    <SubmitButton className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                      Marcar como {STATUS_LABEL[s]}
                    </SubmitButton>
                  </form>
                ))}
            </div>
          </details>

          <Link
            href={editHref}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Editar cancha
          </Link>
        </div>
      </div>

      {actualizado === "1" && (
        <div className="mt-4">
          <Banner type="success" message="Cancha actualizada correctamente." />
        </div>
      )}
      {error && ERROR_MESSAGES[error] && (
        <div className="mt-4">
          <Banner type="error" message={ERROR_MESSAGES[error]} />
        </div>
      )}

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              activeTab === t.key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 max-w-3xl">
        {activeTab === "general" && stats && (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                {photos.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto subida a Azure Blob por el admin
                  <img src={photos[0]} alt="" className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-950 text-6xl">
                    {VENUE_TYPE_ICON[venue.type] ?? "🏟️"}
                  </div>
                )}
                {photos.length > 1 && (
                  <div className="grid grid-cols-4 gap-1 p-1">
                    {photos.slice(1, 5).map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element -- foto subida a Azure Blob por el admin
                      <img key={url} src={url} alt="" className="aspect-square w-full rounded object-cover" />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Información básica</h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Tarifa</dt>
                    <dd className="font-medium text-gray-900">${venue.hourlyRate.toLocaleString("es-CO")}/hora</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Capacidad</dt>
                    <dd className="font-medium text-gray-900">{venue.capacity ? `${venue.capacity} jugadores` : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Superficie</dt>
                    <dd className="font-medium text-gray-900">{venue.surface ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Cobertura</dt>
                    <dd className="font-medium text-gray-900">{venue.coverage ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Ubicación en el complejo</dt>
                    <dd className="font-medium text-gray-900">{venue.locationInComplex ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Descripción</h2>
              <p className="mt-2 text-sm text-gray-600">{venue.description || "Sin descripción todavía."}</p>
              {venue.amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
                  {venue.amenities.map((slug) => (
                    <span key={slug} className="flex items-center gap-1">
                      <span aria-hidden="true">{VENUE_AMENITY_ICON[slug] ?? "✓"}</span>
                      {VENUE_AMENITY_LABEL[slug] ?? slug}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Estadísticas (últimos 30 días)</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xl font-semibold text-gray-900">{stats.bookingsCount}</div>
                  <div className="text-xs text-gray-500">Reservas</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-900">{stats.hoursBooked}</div>
                  <div className="text-xs text-gray-500">Horas reservadas</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-900">${stats.revenue.toLocaleString("es-CO")}</div>
                  <div className="text-xs text-gray-500">Ingresos generados</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-900">{Math.round(stats.occupancyRate * 100)}%</div>
                  <div className="text-xs text-gray-500">Tasa de ocupación</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fotos" && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Fotos ({photos.length}/8)</h2>
            <form action={updateVenue} className="mt-3 grid gap-4">
              <input type="hidden" name="venueId" value={venue.id} />
              <PreserveVenueFields venue={venue} />

              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {photos.map((url) => (
                    <label
                      key={url}
                      className="group/photo relative block cursor-pointer overflow-hidden rounded-md border border-gray-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto subida a Azure Blob por el admin */}
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                      <input type="checkbox" name="removePhotos" value={url} className="absolute right-1 top-1 h-4 w-4 accent-red-600" />
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-medium text-white opacity-0 group-has-[:checked]/photo:opacity-100">
                        Eliminar
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <input
                type="file"
                name="photos"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="block text-xs file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium hover:file:bg-gray-200"
              />

              <SubmitButton className="w-fit rounded-md bg-gray-900 px-4 py-2.5 text-sm text-white hover:bg-gray-800">
                Guardar fotos
              </SubmitButton>
            </form>
          </div>
        )}

        {activeTab === "horarios" && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Horario de operación</h2>
            <p className="mt-2 text-sm text-gray-600">Abierta de 08:00 a 23:00, todos los días (horario general de la plataforma).</p>
            <p className="mt-3 text-sm text-gray-600">
              {upcomingBlocks.length === 0
                ? "Sin bloqueos de mantenimiento programados."
                : `${upcomingBlocks.length} horario(s) bloqueado(s) por mantenimiento próximamente.`}
            </p>
            <Link href={`/admin/mantenimiento?venueId=${venue.id}`} className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline">
              Gestionar bloqueos de horario →
            </Link>
          </div>
        )}

        {activeTab === "precios" && (
          <div className="grid gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Tarifa por defecto</h2>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                ${venue.hourlyRate.toLocaleString("es-CO")} <span className="text-sm font-normal text-gray-500">/ hora</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Se cobra en cualquier turno que no caiga dentro de una excepción de abajo. Se edita desde
                &ldquo;Editar cancha&rdquo;.
              </p>
              <Link href="/admin/auditoria" className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline">
                Ver historial de cambios de tarifa →
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Excepciones por día y hora</h2>
              <p className="mt-1 text-xs text-gray-500">
                Ej. fin de semana o horario nocturno más caro. No se permite guardar dos excepciones que
                se solapen el mismo día.
              </p>

              {sortedPriceRules.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">Sin excepciones todavía — se cobra siempre la tarifa por defecto.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {sortedPriceRules.map((rule) => (
                    <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="text-gray-700">
                        <span className="font-medium text-gray-900">{DAY_OF_WEEK_LABEL[rule.dayOfWeek]}</span> ·{" "}
                        {rule.startTime}-{rule.endTime}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-emerald-700">${rule.price.toLocaleString("es-CO")}</span>
                        <form action={deleteVenuePriceRule}>
                          <input type="hidden" name="venueId" value={venue.id} />
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <SubmitButton
                            confirmMessage="¿Eliminar esta excepción de precio?"
                            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Eliminar
                          </SubmitButton>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <form action={createVenuePriceRule} className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
                <input type="hidden" name="venueId" value={venue.id} />
                <label className="grid gap-1 text-xs font-medium text-gray-500">
                  Día
                  <select name="dayOfWeek" required className="rounded-md border border-gray-300 px-3 py-2.5 text-sm">
                    {DAY_OF_WEEK_LABEL.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-gray-500">
                  Desde
                  <select name="startTime" required className="rounded-md border border-gray-300 px-3 py-2.5 text-sm">
                    {HOUR_OPTIONS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-gray-500">
                  Hasta
                  <select name="endTime" required className="rounded-md border border-gray-300 px-3 py-2.5 text-sm">
                    {HOUR_OPTIONS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-gray-500">
                  Precio/hora
                  <input
                    type="number"
                    inputMode="numeric"
                    name="price"
                    min={0}
                    required
                    className="rounded-md border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </label>
                <div className="sm:col-span-4">
                  <SubmitButton className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
                    + Agregar excepción
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === "relacionadas" && (
          <div className="grid gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Combina con</h2>
              <p className="mt-1 text-xs text-gray-500">
                Reservar {venue.name} bloquea automáticamente estas canchas (comparten el mismo espacio físico).
              </p>
              {linkedVenues.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No combina con ninguna otra cancha.</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {linkedVenues.map((v) => (
                    <li key={v.id}>
                      <Link href={`/admin/canchas/${v.id}`} className="text-sm font-medium text-emerald-700 hover:underline">
                        {VENUE_TYPE_ICON[v.type] ?? "🏟️"} {v.name} →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {referencingVenues.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Es parte de</h2>
                <p className="mt-1 text-xs text-gray-500">Estas canchas combinadas incluyen a {venue.name}.</p>
                <ul className="mt-3 grid gap-2">
                  {referencingVenues.map((v) => (
                    <li key={v.id}>
                      <Link href={`/admin/canchas/${v.id}`} className="text-sm font-medium text-emerald-700 hover:underline">
                        {VENUE_TYPE_ICON[v.type] ?? "🏟️"} {v.name} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "reservas" && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Últimas reservas</h2>
            {recentBookings.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">Sin reservas todavía.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {recentBookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-gray-500">
                      {b.date.toISOString().slice(0, 10)} · {b.startTime}
                    </span>
                    <span className="font-medium text-gray-900">{b.customerName || "Sin nombre"}</span>
                    <span className="text-xs text-gray-500">{b.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/admin/reservas?venueId=${venue.id}`}
              className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
            >
              Ver todas las reservas de esta cancha →
            </Link>
          </div>
        )}

        {activeTab === "mantenimiento" && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Bloqueos de mantenimiento</h2>
            {upcomingBlocks.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">Sin bloqueos programados.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {upcomingBlocks.map((block) => (
                  <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-gray-500">
                      {block.date.toISOString().slice(0, 10)} · {block.startTime}
                    </span>
                    <span className="text-amber-700">{block.reason || "Mantenimiento"}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/admin/mantenimiento?venueId=${venue.id}`}
              className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
            >
              Gestionar bloqueos de horario →
            </Link>
          </div>
        )}
      </div>

      {isEditing && (
        <>
          <Link
            href={closeEditHref}
            aria-label="Cerrar"
            className="fixed inset-0 z-40 bg-black/40"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Editar cancha</h2>
              <Link href={closeEditHref} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">
                ×
              </Link>
            </div>

            <form action={updateVenue} className="grid gap-5 px-6 py-5">
              <input type="hidden" name="venueId" value={venue.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Nombre
                  <input name="name" required minLength={2} defaultValue={venue.name} className="rounded-md border border-gray-300 px-3 py-2.5" />
                </label>
                <label className="grid gap-1 text-sm">
                  Tipo
                  <select name="type" required defaultValue={venue.type} className="rounded-md border border-gray-300 px-3 py-2.5">
                    <option value="FUTBOL_5">Fútbol 5</option>
                    <option value="FUTBOL_7">Fútbol 7</option>
                    <option value="FUTBOL_8">Fútbol 8</option>
                    <option value="FUTBOL_9">Fútbol 9</option>
                    <option value="PADEL">Pádel</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Estado
                  <select name="status" required defaultValue={venue.status} className="rounded-md border border-gray-300 px-3 py-2.5">
                    <option value="ACTIVA">Activa</option>
                    <option value="MANTENIMIENTO">Mantenimiento</option>
                    <option value="INACTIVA">Inactiva</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Tarifa/hora
                  <input type="number" inputMode="numeric" name="hourlyRate" min={0} required defaultValue={venue.hourlyRate} className="rounded-md border border-gray-300 px-3 py-2.5" />
                </label>
              </div>

              <label className="grid gap-1 text-sm">
                Modo de reserva
                <select
                  name="requiresPayment"
                  required
                  defaultValue={venue.requiresPayment ? "true" : "false"}
                  className="rounded-md border border-gray-300 px-3 py-2.5"
                >
                  <option value="true">Pago online (abono + Bold/comprobante)</option>
                  <option value="false">Solicitud sin pago (el admin confirma manual)</option>
                </select>
                <span className="text-xs text-gray-500">
                  En &ldquo;Solicitud sin pago&rdquo; el cliente no paga abono — la reserva no queda apartada
                  hasta que la confirmes a mano desde Reservas.
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Jugadores
                  <input type="number" inputMode="numeric" name="capacity" min={0} defaultValue={venue.capacity ?? ""} placeholder="Opcional" className="rounded-md border border-gray-300 px-3 py-2.5" />
                </label>
                <label className="grid gap-1 text-sm">
                  Ubicación dentro del complejo
                  <input name="locationInComplex" defaultValue={venue.locationInComplex ?? ""} placeholder="Ej. Zona Norte" className="rounded-md border border-gray-300 px-3 py-2.5" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Superficie
                  <select name="surface" defaultValue={venue.surface ?? ""} className="rounded-md border border-gray-300 px-3 py-2.5">
                    <option value="">Sin especificar</option>
                    {VENUE_SURFACE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Cobertura
                  <select name="coverage" defaultValue={venue.coverage ?? ""} className="rounded-md border border-gray-300 px-3 py-2.5">
                    <option value="">Sin especificar</option>
                    {VENUE_COVERAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1 text-sm">
                Descripción
                <textarea name="description" rows={3} defaultValue={venue.description ?? ""} className="rounded-md border border-gray-300 px-3 py-2.5" />
              </label>

              <div>
                <p className="text-sm font-medium text-gray-700">Características</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {VENUE_AMENITIES.map((amenity) => (
                    <label key={amenity.slug} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name="amenities"
                        value={amenity.slug}
                        defaultChecked={venue.amenities.includes(amenity.slug)}
                        className="peer sr-only"
                      />
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-700">
                        {amenity.icon} {amenity.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Canchas relacionadas</p>
                <p className="text-xs text-gray-500">
                  Marca las canchas que comparten el mismo espacio físico — reservar esta cancha bloqueará
                  esas, y viceversa.
                </p>
                {otherVenues.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">No hay otras canchas todavía.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherVenues.map((other) => (
                      <label key={other.id} className="cursor-pointer">
                        <input
                          type="checkbox"
                          name="linkedVenueIds"
                          value={other.id}
                          defaultChecked={venue.linkedVenueIds.includes(other.id)}
                          className="peer sr-only"
                        />
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-700">
                          {other.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                <SubmitButton className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
                  Guardar cambios
                </SubmitButton>
                <Link href={closeEditHref} className="text-sm text-gray-500 hover:underline">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </>
      )}
    </main>
  );
}
