import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { adjustCashShift, resolveDispute } from "@/lib/cash/actions";
import { requireAdminSession } from "@/lib/auth/session-guards";

// El acceso (ADMIN de esta org, o SUPERADMIN) ya lo garantiza app/admin/layout.tsx.
export default async function CajaDetallePage({ params }: { params: Promise<{ shiftId: string }> }) {
  await requireAdminSession();
  const { shiftId } = await params;

  const shift = await db.cashShift.findUnique({ where: { id: shiftId }, include: { employee: true } });
  if (!shift) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Turno de {shift.employee.name}</h1>
      <p className="text-sm text-gray-500">{shift.openedAt.toLocaleString("es-CO")}</p>

      <div className="mt-4 rounded-lg border border-gray-200 p-4 text-sm">
        <div className="flex justify-between">
          <span>Base de apertura</span>
          <span>${shift.openingCash.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>Total canchas</span>
          <span>${(shift.expectedCourtsTotal ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>Total barra</span>
          <span>${(shift.expectedBarTotal ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-2 border-t border-gray-100 pt-2 flex justify-between">
          <span>Efectivo esperado</span>
          <span>${(shift.expectedCash ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>Efectivo contado (actual)</span>
          <span>${(shift.countedCash ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-medium">
          <span>Diferencia</span>
          <span>${(shift.discrepancy ?? 0).toLocaleString("es-CO")}</span>
        </div>
      </div>

      {shift.adjustments.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-medium">Historial de ajustes</h2>
          <ul className="mt-2 grid gap-2">
            {shift.adjustments.map((adjustment, index) => (
              <li key={index} className="rounded-md border border-gray-100 p-3 text-xs text-gray-600">
                <div>
                  {adjustment.adjustedByName} — {adjustment.adjustedAt.toLocaleString("es-CO")}
                </div>
                <div>
                  ${adjustment.previousCountedCash.toLocaleString("es-CO")} → $
                  {adjustment.newCountedCash.toLocaleString("es-CO")}
                </div>
                <div className="italic">&quot;{adjustment.reason}&quot;</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shift.status === "EN_DISPUTA" && (
        <>
          <form action={adjustCashShift} className="mt-6 grid gap-3 rounded-lg border border-gray-200 p-4">
            <input type="hidden" name="shiftId" value={shift.id} />
            <h2 className="text-sm font-medium">Ajustar conteo</h2>
            <label className="grid gap-1 text-sm">
              Nuevo efectivo contado
              <input
                type="number"
                inputMode="numeric"
                name="newCountedCash"
                min={0}
                required
                className="rounded-md border border-gray-300 px-3 py-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Motivo (obligatorio)
              <textarea
                name="reason"
                required
                minLength={5}
                className="rounded-md border border-gray-300 px-3 py-3"
              />
            </label>
            <button type="submit" className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
              Registrar ajuste
            </button>
          </form>

          <form action={resolveDispute} className="mt-4">
            <input type="hidden" name="shiftId" value={shift.id} />
            <button
              type="submit"
              className="w-full rounded-md bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700"
            >
              Cerrar disputa
            </button>
          </form>
        </>
      )}
    </main>
  );
}
