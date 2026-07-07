import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addConsumptionItem, closeAccount } from "@/lib/pos/actions";
import { BookingStatus } from "@/lib/booking/state-machine";

export default async function CuentaPage({
  params,
}: {
  params: Promise<{ org: string; bookingId: string }>;
}) {
  const { org: orgSlug, bookingId } = await params;

  const session = await auth();
  if (!session?.user || session.user.orgSlug !== orgSlug) {
    notFound();
  }

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { venue: true } });
  if (!booking || booking.orgId !== organization.id) {
    notFound();
  }

  const products = await db.consumptionItem.findMany({
    where: { orgId: organization.id, active: true, stock: { gt: 0 } },
    orderBy: { name: "asc" },
  });

  const remainingTariff = booking.totalAmount - booking.depositAmount;
  const totalToCollect = remainingTariff + booking.consumptionTotal;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">
        {booking.venue.name} — {booking.startTime}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {booking.customerName} · {booking.customerPhone}
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 p-4 text-sm">
        <div className="flex justify-between">
          <span>Tarifa restante</span>
          <span>${remainingTariff.toLocaleString("es-CO")}</span>
        </div>

        <div className="mt-2 border-t border-gray-100 pt-2">
          <span className="font-medium">Consumos</span>
          <ul className="mt-1 grid gap-1">
            {booking.consumptionLines.map((line, index) => (
              <li key={index} className="flex justify-between text-gray-600">
                <span>
                  {line.quantity} × {line.productName}
                </span>
                <span>${(line.unitPrice * line.quantity).toLocaleString("es-CO")}</span>
              </li>
            ))}
            {booking.consumptionLines.length === 0 && <li className="text-gray-400">Sin consumos aún.</li>}
          </ul>
        </div>

        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-medium">
          <span>Total a cobrar</span>
          <span>${totalToCollect.toLocaleString("es-CO")}</span>
        </div>
      </div>

      {booking.status === BookingStatus.EN_CURSO && (
        <>
          <form action={addConsumptionItem} className="mt-6 grid gap-3 rounded-lg border border-gray-200 p-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="bookingId" value={booking.id} />
            <label className="grid gap-1 text-sm">
              Producto
              <select name="productId" required className="rounded-md border border-gray-300 px-3 py-3">
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — ${product.price.toLocaleString("es-CO")} ({product.stock} disp.)
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Cantidad
              <input
                type="number"
                inputMode="numeric"
                name="quantity"
                min={1}
                defaultValue={1}
                required
                className="rounded-md border border-gray-300 px-3 py-3"
              />
            </label>
            <button type="submit" className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
              Agregar a la cuenta
            </button>
          </form>

          <form action={closeAccount} className="mt-4 grid gap-3 rounded-lg border border-gray-200 p-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="bookingId" value={booking.id} />
            <label className="grid gap-1 text-sm">
              ¿Cómo pagó el cliente?
              <select
                name="settlementMethod"
                required
                className="rounded-md border border-gray-300 px-3 py-3"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia (Nequi/Daviplata)</option>
                <option value="DATAFONO">Datáfono</option>
              </select>
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700"
            >
              Cobrar (${totalToCollect.toLocaleString("es-CO")})
            </button>
          </form>
        </>
      )}

      {booking.status === BookingStatus.FINALIZADA && (
        <p className="mt-6 rounded-md bg-green-50 p-3 text-sm text-green-800">Esta cuenta ya fue cobrada.</p>
      )}
    </main>
  );
}
