import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { db } from "@/lib/db";
import { CLOSING_HOUR, getDaySlots, OPENING_HOUR, parseDateParam } from "@/lib/booking/availability";
import { getVenuePhotos } from "@/lib/venues/photos";
import { VENUE_TYPE_ICON, VENUE_TYPE_LABEL, VENUE_TYPE_SERVICES } from "@/lib/venues/type-info";
import { TypeFilterSelect } from "./TypeFilterSelect";
import { HourFilterSelect } from "./HourFilterSelect";
import { DateFilterInput } from "./DateFilterInput";
import { SortSelect } from "./SortSelect";
import { Footer } from "@/app/components/Footer";
import { MapSection } from "./MapSection";
import { HeaderMenu } from "./HeaderMenu";
import type { VenueType } from "@/lib/generated/prisma";
import type { MapOrganization } from "./OrganizationsMap";
import styles from "./HomeSearch.module.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const TYPE_FILTERS: { value: VenueType | ""; label: string }[] = [
  { value: "", label: "Todos los deportes" },
  { value: "FUTBOL_5", label: "⚽ Fútbol 5" },
  { value: "FUTBOL_8", label: "⚽ Fútbol 8" },
  { value: "PADEL", label: "🎾 Pádel" },
];

const SORT_OPTIONS = [
  { value: "", label: "Ordenar: Recomendadas" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
] as const;

// Mismo rango de la grilla de cada cancha (AvailabilityGrid/OPENING_HOUR-CLOSING_HOUR) — para que
// "las 6pm" acá signifique el mismo horario que en la página de la cancha.
const HOUR_OPTIONS = Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) =>
  `${String(OPENING_HOUR + i).padStart(2, "0")}:00`,
);

const LOW_AVAILABILITY_THRESHOLD = 3;

// Fondos decorativos para canchas sin fotos todavía — nunca capturas CCTV ni gris plano, solo
// gradientes; se elige por índice para variar la grilla en vez de repetir siempre el mismo.
const PHOTO_PLACEHOLDERS = [styles.phNight, styles.phStadium, styles.phPadel, styles.phBlueCourt, styles.phDay];

// Home multi-tenant: en vez de listar los complejos (organizaciones) como enlaces crudos, es un
// buscador de canchas que cruza todos los complejos — el cliente busca por lo que quiere jugar, no
// por el nombre del negocio que todavía no conoce.
//
// Nota de honestidad (decidido explícitamente con el cliente): sin calificaciones/reseñas falsas,
// sin cuentas de cliente (favoritos/mensajes/login — flujo de invitado), sin conteos ni badges de
// "demanda" inventados, y sin promociones que no existen. Todo lo que se muestra sale de datos
// reales, salvo la distancia ("A 1,2 km") que es texto fijo de la maqueta — no hay geolocalización
// real todavía (decisión explícita al portar este diseño).
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; hora?: string; fecha?: string; sort?: string }>;
}) {
  const { q, type, hora, fecha, sort } = await searchParams;
  const query = q?.trim() ?? "";
  const activeType = type && type in VENUE_TYPE_LABEL ? (type as VenueType) : "";
  const activeHour = hora && HOUR_OPTIONS.includes(hora) ? hora : "";
  // A diferencia de parseDateParam (que siempre cae a hoy), acá hace falta distinguir "el cliente
  // eligió esta fecha" de "no eligió ninguna" para no filtrar de más cuando no lo pidió.
  const dateExplicit = Boolean(fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha));
  const activeDate = parseDateParam(fecha);
  const activeSort = SORT_OPTIONS.find((s) => s.value === sort) ?? SORT_OPTIONS[0];

  let venues = await db.venue.findMany({
    where: {
      active: true,
      ...(activeType ? { type: activeType } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { organization: { name: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { organization: true },
    orderBy:
      activeSort.value === "precio_asc"
        ? { hourlyRate: "asc" }
        : activeSort.value === "precio_desc"
          ? { hourlyRate: "desc" }
          : { name: "asc" },
  });

  // Disponibilidad real de la fecha activa (hoy por defecto) para TODAS las canchas del listado —
  // alimenta el badge de estado y el filtro de hora/fecha específica.
  let slotsPerVenue = await Promise.all(venues.map((venue) => getDaySlots(venue.id, activeDate)));

  if (activeHour || dateExplicit) {
    const keep = venues
      .map((_, index) => index)
      .filter((index) =>
        activeHour
          ? slotsPerVenue[index].some((slot) => slot.available && slot.startTime === activeHour)
          : slotsPerVenue[index].some((slot) => slot.available),
      );
    venues = keep.map((index) => venues[index]);
    slotsPerVenue = keep.map((index) => slotsPerVenue[index]);
  }

  // Organizaciones únicas con pin propio (ver LocationForm en /admin/configuracion) entre las que
  // tienen canchas en el resultado actual — si un complejo no marcó su ubicación todavía, no
  // aparece en el mapa en vez de romperlo con coordenadas inventadas.
  const mapOrganizations: MapOrganization[] = Array.from(
    venues.reduce((byOrg, venue) => {
      const { organization } = venue;
      if (organization.latitude == null || organization.longitude == null) return byOrg;
      const existing = byOrg.get(organization.id);
      if (existing) {
        existing.venueCount += 1;
      } else {
        byOrg.set(organization.id, {
          id: organization.id,
          slug: organization.slug,
          name: organization.name,
          logoUrl: organization.logoUrl,
          latitude: organization.latitude,
          longitude: organization.longitude,
          venueCount: 1,
        });
      }
      return byOrg;
    }, new Map<string, MapOrganization>()).values(),
  );

  return (
    <div className={`${styles.home} ${plusJakarta.className}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} priority className="h-7 w-auto" />
        </Link>
        <nav className={styles.headerNav}>
          <button type="button" className={styles.navItem}>
            ❓ <span>Ayuda</span>
          </button>
          <Link href="/mis-reservas" className={styles.navItem}>
            📅 <span>Mis reservas</span>
          </Link>
          <HeaderMenu />
        </nav>
      </header>

      <section className={styles.hero}>
        <h1>Encuentra tu cancha</h1>
        <p className={styles.sub}>Reserva en minutos, juega más.</p>

        <div className={styles.searchCard}>
          <div className={`${styles.field} ${styles.fSport}`}>
            <label>Tipo de cancha</label>
            <TypeFilterSelect options={TYPE_FILTERS} selectedType={activeType} />
          </div>
          <div className={`${styles.field} ${styles.fFecha}`}>
            <label>Fecha</label>
            <DateFilterInput selectedDateIso={activeDate} />
          </div>
          <div className={`${styles.field} ${styles.fHora}`}>
            <label>Hora</label>
            <HourFilterSelect hours={HOUR_OPTIONS} selectedHour={activeHour} />
          </div>
          <a href="#resultados" className={`${styles.btnPrimary} ${styles.fCta}`}>
            Buscar canchas
          </a>
        </div>
      </section>

      <div className={styles.trust}>
        <div className={styles.tItem}>✅ Confirmación inmediata</div>
        <div className={styles.tItem}>🔒 Pago 100% seguro con Bold</div>
        <div className={styles.tItem}>💬 Soporte por WhatsApp</div>
      </div>

      <div className={styles.resultsWrap} id="resultados">
        <div className={styles.resultsPanel}>
          <div>
            <div className={styles.resultsHead}>
              <h2>
                {venues.length} {venues.length === 1 ? "cancha disponible" : "canchas disponibles"}
              </h2>
              <div className={styles.headControls}>
                <SortSelect options={SORT_OPTIONS} selectedSort={activeSort.value} />
                <button type="button" className={styles.filterBtn}>
                  Filtros ⌄
                </button>
              </div>
            </div>

            {venues.map((venue, index) => {
              const [coverPhoto] = getVenuePhotos(venue);
              const slotsToday = slotsPerVenue[index];
              const availableToday = slotsToday.filter((slot) => slot.available);
              const services = VENUE_TYPE_SERVICES[venue.type]?.slice(0, 3) ?? [];
              const placeholder = PHOTO_PLACEHOLDERS[index % PHOTO_PLACEHOLDERS.length];

              const statusBadge =
                availableToday.length === 0
                  ? { label: "Sin cupos esta fecha", extraClass: styles.gray }
                  : availableToday.length <= LOW_AVAILABILITY_THRESHOLD
                    ? { label: "Pocos horarios libres", extraClass: styles.amber }
                    : { label: "Disponible", extraClass: "" };

              const orgLocation =
                [venue.organization.municipality, venue.organization.department].filter(Boolean).join(", ") ||
                venue.organization.country;

              return (
                <Link
                  key={venue.id}
                  href={`/${venue.organization.slug}/${venue.id}?date=${activeDate}`}
                  className={styles.card}
                >
                  <div className={styles.cardPhoto}>
                    <span className={`${styles.badge} ${statusBadge.extraClass}`}>{statusBadge.label}</span>
                    <span className={styles.sportTag}>{VENUE_TYPE_LABEL[venue.type] ?? venue.type}</span>
                    {coverPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos de canchas vienen de URLs externas arbitrarias que pega el admin
                      <img src={coverPhoto} alt={venue.name} />
                    ) : (
                      <div className={`${styles.ph} ${placeholder}`}>{VENUE_TYPE_ICON[venue.type] ?? "🏟️"}</div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <div>
                        <h3>{venue.name}</h3>
                        <div className={styles.location}>
                          {orgLocation}
                          &nbsp;•&nbsp; A 1,2 km
                        </div>
                      </div>
                      <div className={styles.price}>
                        <div className={styles.desde}>Desde</div>
                        <div className={styles.amount}>${venue.hourlyRate.toLocaleString("es-CO")}</div>
                        <div className={styles.per}>/ hora</div>
                      </div>
                    </div>

                    {services.length > 0 && (
                      <div className={styles.amenities}>
                        {services.map((service) => (
                          <span key={service.label} className={styles.amenity}>
                            {service.icon} {service.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className={styles.cardBottom}>
                      <div className={styles.priceMobile}>
                        <div className={styles.desde}>Desde</div>
                        <div className={styles.amount}>
                          ${venue.hourlyRate.toLocaleString("es-CO")} <small>/ hora</small>
                        </div>
                      </div>
                      <span className={styles.btnSchedule}>Ver horarios</span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {venues.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.icon}>🔍</div>
                <p className="mt-2">No encontramos canchas con ese criterio.</p>
                <p>Prueba con otra fecha, hora, o quita algún filtro.</p>
              </div>
            )}
          </div>

          <div className={styles.mapCol}>
            <div className={styles.map}>
              {mapOrganizations.length > 0 ? (
                <MapSection organizations={mapOrganizations} />
              ) : (
                <div className={styles.mapEmpty}>Todavía ningún complejo marcó su ubicación en el mapa.</div>
              )}
              <button type="button" className={styles.locateBtn} aria-label="Mi ubicación">
                📍
              </button>
              <div className={styles.exploreCard}>
                <p>
                  Explora las canchas
                  <br />
                  en el mapa
                </p>
                <button type="button" className={styles.go} aria-label="Explorar mapa">
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerBand}>
        <div className={styles.footerInner}>
          <div className={styles.footFeature}>
            <div className={styles.ficon}>⏱️</div>
            <div>
              <h4>Reserva en minutos</h4>
              <p>Sin llamadas, sin esperas.</p>
            </div>
          </div>
          <div className={styles.footFeature}>
            <div className={styles.ficon}>🔒</div>
            <div>
              <h4>Pago seguro</h4>
              <p>Paga online de forma fácil y segura.</p>
            </div>
          </div>
          <div className={styles.footFeature}>
            <div className={styles.ficon}>💬</div>
            <div>
              <h4>Soporte siempre</h4>
              <p>Te ayudamos por WhatsApp.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
