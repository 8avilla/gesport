import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getLowStockProducts, getPendingPaymentBookings, getPendingSolicitudBookings } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";

export default async function AlertasPage() {
  const { orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const [lowStockProducts, pendingBookings, pendingSolicitudes] = await Promise.all([
    getLowStockProducts(organization.id),
    getPendingPaymentBookings(organization.id),
    getPendingSolicitudBookings(organization.id),
  ]);

  return (
    <main className="px-6 py-10">
      <h1 className="text-xl font-semibold">Alertas — {organization.name}</h1>

      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700">
          ⚠️ Stock bajo {lowStockProducts.length > 0 && `(${lowStockProducts.length})`}
        </h2>
        {lowStockProducts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Todo el inventario está por encima de su umbral.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {lowStockProducts.map((product) => (
              <li key={product.id} className="flex items-center justify-between text-sm">
                <span>{product.name}</span>
                <span className="text-amber-700">
                  quedan {product.stock} (umbral {product.lowStockThreshold})
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/inventario" className="mt-3 inline-block text-sm text-blue-700 underline">
          Ir a inventario
        </Link>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700">
          📅 Reservas pendientes de pago hoy {pendingBookings.length > 0 && `(${pendingBookings.length})`}
        </h2>
        {pendingBookings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Sin reservas pendientes de pago hoy.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {pendingBookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between text-sm">
                <span>
                  {booking.startTime} — {booking.venueName}
                </span>
                <span className="text-gray-500">{booking.customerName}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/reservas?status=PENDIENTE_PAGO" className="mt-3 inline-block text-sm text-blue-700 underline">
          Ir a reservas
        </Link>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700">
          🙋 Solicitudes sin confirmar {pendingSolicitudes.length > 0 && `(${pendingSolicitudes.length})`}
        </h2>
        {pendingSolicitudes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Sin solicitudes pendientes de confirmar.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {pendingSolicitudes.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between text-sm">
                <span>
                  {booking.dateIso} {booking.startTime} — {booking.venueName}
                </span>
                <span className="text-gray-500">{booking.customerName}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/reservas?status=SOLICITADA" className="mt-3 inline-block text-sm text-blue-700 underline">
          Ir a reservas
        </Link>
      </div>
    </main>
  );
}
