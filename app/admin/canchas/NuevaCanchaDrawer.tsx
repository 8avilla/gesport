import Link from "next/link";
import { createVenue } from "@/lib/admin/actions";
import { SubmitButton } from "@/app/components/SubmitButton";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

export function NuevaCanchaDrawer({ closeHref }: { closeHref: string }) {
  return (
    <>
      <Link href={closeHref} aria-label="Cerrar" className="fixed inset-0 z-40 bg-black/40" />
      {/* Mobile: bottom sheet (se ancla abajo, esquinas superiores redondeadas, alto acotado).
          Desktop (sm+): drawer lateral de toda la altura, como el resto del admin. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl
          sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:max-h-none sm:h-full sm:w-full sm:max-w-md sm:rounded-t-none"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Nueva cancha</h2>
          <Link href={closeHref} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </Link>
        </div>

        <form action={createVenue} className="grid gap-4 px-6 py-5">
          <label className="text-sm font-medium text-gray-700">
            Nombre *
            <input name="name" required minLength={2} placeholder="Ej. Cancha 4 — Pádel" className={INPUT_CLASS} />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Tipo *
            <select name="type" required defaultValue="FUTBOL_5" className={INPUT_CLASS}>
              <option value="FUTBOL_5">Fútbol 5</option>
              <option value="FUTBOL_7">Fútbol 7</option>
              <option value="FUTBOL_8">Fútbol 8</option>
              <option value="FUTBOL_9">Fútbol 9</option>
              <option value="PADEL">Pádel</option>
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Tarifa por hora *
            <input type="number" inputMode="numeric" name="hourlyRate" min={0} required placeholder="120000" className={INPUT_CLASS} />
          </label>

          <p className="text-xs text-gray-400">
            Podrás agregar fotos, capacidad, superficie y horarios desde la ficha de la cancha una vez creada.
          </p>

          <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-4">
            <SubmitButton
              pendingLabel="Creando…"
              className="flex-1 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Crear cancha
            </SubmitButton>
            <Link href={closeHref} className="text-sm text-gray-500 hover:underline">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
