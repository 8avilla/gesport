# CODE_STYLE.md

Convenciones de código realmente usadas en este repo. Complementa (no reemplaza) las reglas ya
fijadas en `AGENTS.md` — si algo choca, `AGENTS.md` gana.

---

## Idioma

- Identificadores y tipos: **inglés**.
- Comentarios, copy de UI, mensajes de commit: **español**.
- Los comentarios explican el **por qué**, nunca el qué. Si un comentario solo repite lo que ya dice
  el código, bórralo. Resérvalos para: una restricción no obvia, el workaround de un bug real, un
  invariante que sorprendería a quien lea el código después.

## Formato

- 2 espacios de indentación.
- Líneas ≤120 caracteres — es una convención de equipo, **no** la aplica ESLint; vigílala a mano.
- Comillas dobles, punto y coma, coma final en listas/objetos multilínea.

## Nombres

- `camelCase`: variables, funciones.
- `PascalCase`: componentes, tipos, interfaces.
- `UPPER_SNAKE_CASE`: constantes a nivel de módulo (`OPENING_HOUR`, `VENUE_TYPE_LABEL`) y miembros de
  enum.
- Archivos de componentes en `PascalCase.tsx` (`AvailabilityGrid.tsx`); módulos de `lib/` en
  `camelCase.ts` o `kebab-case.ts` (ambos aparecen en el repo — no hay una regla estricta única).

## Tipos

- Nunca `any`. Prefiere `unknown` + un type guard, o el tipo exacto.
- El operador `!` (non-null assertion) con cuidado — es aceptable dentro de un `.filter().map()` sobre
  índices donde TypeScript no puede inferir la correlación entre dos arrays paralelos (ver
  `slotsPerVenue` en `app/page.tsx`), no como atajo general.
- Los enums vienen de Prisma (`$Enums.BookingStatus`, etc.), re-exportados desde
  `lib/booking/state-machine.ts` — no los redefinas a mano en otro archivo.

## Imports

- Alias absoluto `@/*` para cualquier cosa fuera del directorio actual; relativo (`./Cosa`) solo para
  el mismo directorio.
- Orden: paquetes externos, luego `@/lib/...`, luego relativos. Es una convención seguida a mano, no
  hay un plugin de auto-orden configurado.

## Componentes

- Un componente por archivo, con el mismo nombre que el archivo.
- Server Component salvo que necesite interactividad — agrega `"use client"` solo entonces.
- Props desestructuradas directo en la firma de la función, tipadas con un objeto `{ ... }` inline
  para componentes simples; un `interface`/`type` con nombre propio solo si la forma se reutiliza o es
  grande.

## Server Actions (`lib/*/actions.ts`)

- `"use server"` al inicio del archivo.
- Todo input se valida con Zod (`z.object({...}).safeParse(...)`) — nunca confíes en `FormData`
  directamente.
- La verificación de sesión/rol va inmediatamente después de validar, antes de cualquier lectura a la
  base de datos.
- Devuelve una unión discriminada (`{ ok: true, ... } | { ok: false, error: string }`) cuando el
  cliente necesita ramificar sobre el resultado; usa `redirect()`/`notFound()` cuando la acción
  siempre navega.

## Manejo de errores

- Rate-limit en los endpoints públicos que mutan datos (`lib/security/rate-limit.ts`) — ver
  `createBookingShell`, `uploadManualReceipt`.
- Prefiere retornos tempranos (`if (!x) return`) sobre condicionales anidados.
- `isUniqueConstraintError()` tiene una doble verificación (`instanceof` O el duck-type
  `error.code === "P2002"`) a propósito: Turbopack puede duplicar el módulo de Prisma en dev,
  rompiendo el `instanceof` para un error P2002 genuino. Si tocas esa función, conserva ambas.

## Estado y efectos

- Patrón `useRef` como guarda para efectos "solo una vez al montar" que deben sobrevivir el
  doble-invoke de React Strict Mode en dev — no una bandera `cancelled` (ver `initRef` en
  `ReservarForm.tsx`; la bandera `cancelled` fue justamente la causa de un bug real de reservas
  huérfanas).
- Autoguardado de inputs con debounce (600ms) en vez de guardar en cada tecla o pedir un botón
  "Guardar" aparte.
- Un control que solo necesita actualizar un query param y renavegar usa `useRouter` +
  `useSearchParams` (ver `DateFilterInput.tsx`, `HourFilterSelect.tsx`, `SortSelect.tsx`) — copia ese
  patrón para controles de filtro nuevos en vez de inventar uno distinto.

## Regla de honestidad en el copy de UI (específica de este proyecto, no negociable)

- Nunca mostrar un número, calificación, conteo o promesa que la app no pueda respaldar con datos
  reales. Sin reseñas/calificaciones inventadas, sin badges de "demanda" ficticios, sin promociones
  que no existen. Si una cifra no sale de una consulta real a la base de datos, no se muestra como si
  lo fuera.

## Verificación de cambios

- No hay framework de tests en el repo — la verificación es manual: `npm run dev`, y cuando hace
  falta probar una interacción real en el navegador, se instala Playwright al vuelo
  (`npm install --no-save playwright`), se corre un script puntual, y se desinstala después. Nunca
  se deja Playwright como dependencia permanente.
- Antes de dar un cambio por terminado: `npx tsc --noEmit` y `npm run lint` deben quedar limpios.
