import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomersReport } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { SubmitButton } from "@/app/components/SubmitButton";

const SORT_OPTIONS = [
  { value: "reciente", label: "Más reciente" },
  { value: "reservas", label: "Más reservas" },
  { value: "gastado", label: "Más gastado" },
  { value: "nombre", label: "Nombre (A-Z)" },
] as const;

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { orgSlug } = await requireAdminSession();
  const { q, sort } = await searchParams;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const activeSort = SORT_OPTIONS.find((s) => s.value === sort)?.value ?? "reciente";
  const search = q?.trim() || undefined;

  const { customers, stats, truncated } = await getCustomersReport(organization.id, {
    search,
    sort: activeSort,
  });

  const hasActiveFilters = Boolean(search || sort);

  const statCards = [
    { icon: "📇", iconBg: "bg-blue-50", value: String(stats.totalCustomers), label: "Total de clientes" },
    { icon: "🆕", iconBg: "bg-emerald-50", value: String(stats.newThisMonth), label: "Nuevos este mes" },
    {
      icon: "💰",
      iconBg: "bg-purple-50",
      value: `$${stats.totalSpent.toLocaleString("es-CO")}`,
      label: "Gasto total histórico",
    },
    {
      icon: "📊",
      iconBg: "bg-amber-50",
      value: `$${stats.avgSpentPerCustomer.toLocaleString("es-CO")}`,
      label: "Gasto promedio/cliente",
    },
  ];

  return (
    <main className="px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
        <p className="mt-1 text-sm text-gray-500">Historial y gasto de las personas que han reservado contigo.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${card.iconBg} text-lg`}>
              {card.icon}
            </div>
            <div className="mt-3 text-xl font-semibold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      <form
        method="get"
        className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4"
      >
        <div className="col-span-2 sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500">Buscar</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nombre o teléfono…"
              className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Ordenar por</label>
          <select name="sort" defaultValue={activeSort} className={INPUT_CLASS}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <SubmitButton
            pendingLabel="Filtrando…"
            className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Filtrar
          </SubmitButton>
          {hasActiveFilters && (
            <Link href="/admin/clientes" className="text-sm text-gray-500 underline">
              Limpiar
            </Link>
          )}
        </div>
        <div className="col-span-2 sm:col-span-4">
          <span className="text-sm text-gray-500">
            {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
            {truncated && " (primeros — acota la búsqueda para ver el resto)"}
          </span>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {customers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">📭</div>
            <p className="mt-2 text-sm text-gray-500">
              {hasActiveFilters ? "Sin clientes para esta búsqueda." : "Todavía no hay reservas de clientes."}
            </p>
          </div>
        ) : (
          <>
            {/* Tabla en pantallas medianas o más grandes */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Reservas</th>
                  <th className="px-4 py-3">Primera reserva</th>
                  <th className="px-4 py-3">Última reserva</th>
                  <th className="px-4 py-3 text-right">Total gastado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer.phone} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-xs text-gray-500">
                        {customer.phone}
                        {customer.email && ` · ${customer.email}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{customer.bookingsCount}</div>
                      {(customer.cancelledCount > 0 || customer.noShowCount > 0) && (
                        <div className="text-xs text-gray-400">
                          {customer.cancelledCount > 0 && `${customer.cancelledCount} canceladas`}
                          {customer.cancelledCount > 0 && customer.noShowCount > 0 && " · "}
                          {customer.noShowCount > 0 && `${customer.noShowCount} no-show`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{customer.firstBookingDate}</td>
                    <td className="px-4 py-3 text-gray-500">{customer.lastBookingDate}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">
                      ${customer.totalSpent.toLocaleString("es-CO")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/reservas?vista=lista&dateFrom=&dateTo=&phone=${encodeURIComponent(customer.phone)}`}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Ver reservas
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tarjetas en mobile */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {customers.map((customer) => (
                <li key={customer.phone} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-xs text-gray-500">{customer.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-emerald-700">${customer.totalSpent.toLocaleString("es-CO")}</div>
                      <div className="text-xs text-gray-500">{customer.bookingsCount} reservas</div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Primera: {customer.firstBookingDate} · Última: {customer.lastBookingDate}
                  </div>
                  <Link
                    href={`/admin/reservas?vista=lista&dateFrom=&dateTo=&phone=${encodeURIComponent(customer.phone)}`}
                    className="mt-3 inline-block rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Ver reservas
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
