# FRONTEND_ARCHITECTURE.md

Describe la arquitectura **real** del código de Cancha Libre. A diferencia de `DESIGN_SYSTEM.md` /
`UI_RULES.md` / `COMPONENTS.md` (que son una especificación aspiracional, no siempre implementada),
este documento y `CODE_STYLE.md` deben describir lo que el código realmente hace. Si algo cambia en
el código, actualiza este archivo — no lo dejes desincronizado.

---

## Stack

- **Next.js 16.2.10**, App Router, Turbopack. Es una versión con cambios que rompen convenciones
  conocidas — antes de asumir cómo funciona algo, revisa `node_modules/next/dist/docs/`.
- **React 19.2.4**, Server Components por defecto.
- **TypeScript** estricto.
- **Tailwind CSS v4** — sin tokens de diseño propios, paleta default de Tailwind (emerald como acento
  de marca). No existen las variables CSS que describe `DESIGN_SYSTEM.md`.
- **Prisma 6.19.3 + MongoDB Atlas** — fijado por debajo de la 7.x a propósito: Prisma 7 quitó el
  soporte de cliente directo para Mongo (solo adaptadores SQL o Accelerate).
- **Auth.js** (`next-auth` v5 beta), sesión JWT, roles embebidos en el token.
- **SWR** para polling del lado del cliente (no hay WebSockets ni SSE).
- **sonner** para toasts.
- **recharts** para gráficas del dashboard admin.

## Multi-tenancy

- Una sola app Next.js. El tenant se resuelve por slug en la URL: `/[org]/...`.
- `proxy.ts` en la raíz (no `middleware.ts` — Next 16 lo renombró) protege `/[org]/pos/*` y
  `/[org]/admin/*` con un solo matcher: valida sesión, que el slug de la URL coincida con el de la
  sesión, y el rol (ADMIN para `/admin`).
- El rol `SUPERADMIN` no pertenece a ninguna organización (`session.user.orgSlug` queda `undefined`)
  y se salta la comparación de slug — puede entrar al panel admin de cualquier organización.

## Estructura de rutas (real, no aspiracional)

```
app/
  page.tsx                          — buscador de canchas cruzando todos los complejos (home)
  login/page.tsx                    — login de staff (ADMIN/EMPLOYEE/SUPERADMIN)
  superadmin/                       — panel de plataforma (gestiona organizaciones)
  components/                       — client components compartidos entre rutas (BoldButton, etc.)
  api/
    auth/[...nextauth]/route.ts
    webhooks/bold/route.ts
    cron/expire-bookings/route.ts
    [org]/pos/bookings-today/route.ts
    [org]/reserva/[bookingId]/status/route.ts
    [org]/venues/[venueId]/availability/route.ts
  [org]/
    page.tsx                        — home del complejo (lista de canchas)
    [venueId]/
      page.tsx                      — selector de día/hora (2 columnas en desktop)
      reservar/page.tsx             — datos + resumen + pago, una sola pantalla (sin wizard)
    reserva/[bookingId]/page.tsx    — estado/confirmación de la reserva
    admin/                          — solo ADMIN (y SUPERADMIN)
    pos/                            — ADMIN + EMPLOYEE

lib/
  booking/            — máquina de estados, disponibilidad, server actions de reserva
  payments/bold.ts    — integración Bold (checkout + verificación de webhook)
  admin/, pos/, cash/, superadmin/ — server actions y queries por feature
  auth.ts, auth/session-guards.ts
  time/business-day.ts — Colombia con offset fijo UTC-5 (sin horario de verano)
  venues/             — helpers compartidos: fotos (fallback a legado), tipo/superficie/servicios
  org/maps.ts         — links de Google Maps por organización, hardcodeados (no hay campo de
                        dirección real en el modelo todavía)
  data/colombia.ts    — datos DIVIPOLA (departamentos/municipios) para el formulario de ubicación
  generated/prisma/   — cliente generado, nunca editar a mano
```

## Server vs Client Components

- Por defecto, todo es Server Component. Las páginas leen directo de `lib/db` (Prisma) — no hay una
  capa de API intermedia para su propia data.
- `"use client"` solo donde hace falta de verdad: formularios con estado local, cualquier cosa con
  `useState`/`useEffect`/`useRouter`, polling con SWR, APIs del navegador (`sessionStorage`).
- Los client components que solo usa una página viven junto a esa página (ej.
  `app/[org]/[venueId]/AvailabilityGrid.tsx`). Solo van a `app/components/` si los usa más de una ruta.

## Fetching de datos

- "Tiempo real" = polling con SWR cada 4–5s (estado de reserva, grilla de disponibilidad, lista del
  POS) — no WebSockets/Change Streams. Es lo más simple que funciona a la escala actual; si el
  tráfico crece, ahí se cambiaría por SSE + Change Streams de Mongo.
- Las mutaciones son Server Actions (`"use server"`), invocadas directo desde un client component o
  vía `<form action={...}>`. No hay una librería de fetching de datos aparte de SWR.

## Particularidades del flujo de reserva

- La reserva se crea **al montar la página** (`createBookingShell`, lado cliente), no al enviar el
  formulario final — así el botón de pago ya está listo sin pasos intermedios. Protegido con un
  `useRef` (no una bandera `cancelled`) contra el doble-invoke de React Strict Mode en dev.
- Anti-overbooking: índice único `Booking.blockingSlotKey` (`<venueId>_<fecha>_<horaInicio>` mientras
  bloquea el cupo, `released_<bookingId>` al pasar a un estado terminal). MongoDB no soporta índices
  únicos parciales/sparse — este patrón logra la misma garantía sin necesitarlos.
- Pago con Bold: botón personalizado (`new BoldCheckout({...}).open()`), no el widget con marcador en
  el DOM — evita un bug real de `next/script` (deduplica por `src` a nivel de página, así que en una
  segunda reserva de la misma sesión el botón nunca aparecía).

## Límites conocidos de Prisma + MongoDB

- Sin índices únicos parciales/sparse (de ahí el truco de `blockingSlotKey`).
- `mode: "insensitive"` en `contains` **sí** funciona en Mongo (no asumir que es exclusivo de Postgres).
- `distinct` sobre varios campos a la vez funciona.
- Los arrays (`imageUrls: String[]`) con `@default([])` **no** se retro-aplican a documentos ya
  existentes — un documento viejo puede traer `undefined` en ese campo en tiempo de ejecución aunque
  el tipo diga `string[]`. Leer siempre con `?? []`.

## Otras particularidades

- La variable `PORT` no puede vivir solo en `.env`: Next levanta su servidor HTTP antes de leer su
  propio `.env`. Los scripts usan `dotenv-cli` (`dotenv -e .env -- next dev`) para inyectarla antes.

## Por dónde empezar

- ¿Página nueva de cliente? Mira `app/[org]/[venueId]/page.tsx` para el patrón Server Component +
  client sub-component.
- ¿Mutación nueva? `lib/<feature>/actions.ts`, validada con Zod, `"use server"`.
- ¿Filtro/control que solo actualiza un query param? Copia `app/DateFilterInput.tsx` o
  `app/HourFilterSelect.tsx` (client component chico que navega con `useRouter`/`useSearchParams`),
  no inventes un patrón nuevo.
