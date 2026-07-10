import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/session-guards";

export default async function ResultadoCierrePage({
  params,
}: {
  params: Promise<{ org: string; shiftId: string }>;
}) {
  const { org: orgSlug, shiftId } = await params;

  await requireStaffSession(orgSlug);

  const shift = await db.cashShift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.expectedCash === null || shift.countedCash === null) {
    notFound();
  }

  const isMismatch = shift.status === "EN_DISPUTA";

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold">Reporte del cierre</h1>

      {isMismatch ? (
        <p className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          Se detectó una diferencia entre lo contado y lo esperado. La caja quedó bloqueada y ya se
          notificó al administrador para revisarla.
        </p>
      ) : (
        <p className="mt-4 rounded-md bg-green-50 p-4 text-sm text-green-800">Turno cerrado, todo cuadró.</p>
      )}

      <div className="mt-4 rounded-lg border border-gray-200 p-4 text-sm">
        <div className="flex justify-between">
          <span>Total canchas</span>
          <span>${(shift.expectedCourtsTotal ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>Total barra</span>
          <span>${(shift.expectedBarTotal ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-2 border-t border-gray-100 pt-2 flex justify-between">
          <span>Efectivo esperado (con base)</span>
          <span>${shift.expectedCash.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>Efectivo contado</span>
          <span>${shift.countedCash.toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-medium">
          <span>Diferencia</span>
          <span>${(shift.discrepancy ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-2 flex justify-between text-gray-500">
          <span>Transferencias</span>
          <span>${(shift.expectedTransfer ?? 0).toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Datáfono</span>
          <span>${(shift.expectedCard ?? 0).toLocaleString("es-CO")}</span>
        </div>
      </div>
    </main>
  );
}
