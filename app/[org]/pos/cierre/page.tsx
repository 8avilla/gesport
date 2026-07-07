import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOpenShift } from "@/lib/pos/queries";
import { submitBlindCount } from "@/lib/cash/actions";

export default async function SolicitarCierrePage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;

  const session = await auth();
  if (!session?.user || session.user.orgSlug !== orgSlug) {
    notFound();
  }

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const shift = await getOpenShift(organization.id);
  if (!shift) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold">Solicitar cierre de turno</h1>
      <p className="mt-2 text-sm text-gray-500">
        Cuenta el efectivo físico que tienes en caja <strong>ahora mismo</strong> e ingrésalo abajo. El
        sistema solo calculará el total esperado después de que confirmes tu conteo.
      </p>

      <form action={submitBlindCount} className="mt-6 grid gap-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="shiftId" value={shift.id} />
        <label className="grid gap-1 text-sm">
          Efectivo contado
          <input
            type="number"
            inputMode="numeric"
            name="countedCash"
            min={0}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800"
        >
          Confirmar conteo y cerrar turno
        </button>
      </form>
    </main>
  );
}
