import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth/session";
import { logoutCustomer } from "@/lib/customer-auth/actions";
import { formatBusinessDayLabel } from "@/lib/time/business-day";
import { CustomerLoginForm } from "./CustomerLoginForm";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
};

const STATUS_CLASS: Record<string, string> = {
  PENDIENTE_PAGO: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  CONFIRMADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  EN_CURSO: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  FINALIZADA: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  CANCELADA: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

export default async function MisReservasPage() {
  const customer = await getCustomerSession();

  if (!customer) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} className="h-9 w-auto" priority />
        <h1 className="mt-6 text-xl font-semibold text-gray-900">Mis reservas</h1>
        <p className="mt-1 text-sm text-gray-500">Ingresa con tu WhatsApp para ver tus reservas.</p>
        <CustomerLoginForm />
      </main>
    );
  }

  const bookings = await db.booking.findMany({
    where: { customerPhone: customer.phone },
    include: { venue: true, organization: true },
    orderBy: { date: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis reservas</h1>
          <p className="mt-1 text-sm text-gray-500">Hola, {customer.name.split(" ")[0]}.</p>
        </div>
        <form action={logoutCustomer}>
          <button type="submit" className="text-sm font-medium text-gray-500 underline">
            Cerrar sesión
          </button>
        </form>
      </div>

      <ul className="mt-6 grid gap-3">
        {bookings.map((booking) => {
          const { weekday, day, month } = formatBusinessDayLabel(booking.date.toISOString().slice(0, 10));
          return (
            <li key={booking.id}>
              <Link
                href={`/${booking.organization.slug}/reserva/${booking.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <div>
                  <p className="font-medium text-gray-900">{booking.venue.name}</p>
                  <p className="text-sm text-gray-500">{booking.organization.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {weekday} {day} de {month} · {booking.startTime}-{booking.endTime}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[booking.status] ?? ""}`}
                >
                  {STATUS_LABEL[booking.status] ?? booking.status}
                </span>
              </Link>
            </li>
          );
        })}

        {bookings.length === 0 && (
          <li className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            Todavía no tienes reservas con este número.
          </li>
        )}
      </ul>
    </main>
  );
}
