import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getRevenueReport } from "@/lib/admin/queries";

export default async function ReportesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const report = await getRevenueReport(organization.id, 14);
  const totalCourts = report.reduce((sum, day) => sum + day.courtsTotal, 0);
  const totalBar = report.reduce((sum, day) => sum + day.barTotal, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold">Reportes — últimos 14 días</h1>
      <p className="mt-1 text-sm text-gray-500">
        Total canchas: ${totalCourts.toLocaleString("es-CO")} · Total barra: $
        {totalBar.toLocaleString("es-CO")}
      </p>

      <div className="relative mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 whitespace-nowrap">Fecha</th>
                <th className="py-2 pr-4 whitespace-nowrap">Canchas</th>
                <th className="py-2 pr-4 whitespace-nowrap">Barra</th>
                <th className="py-2 pr-4 whitespace-nowrap">Finalizadas</th>
                <th className="py-2 pr-4 whitespace-nowrap">Canceladas</th>
                <th className="py-2 pr-4 whitespace-nowrap">No-show</th>
              </tr>
            </thead>
            <tbody>
              {report.map((day) => (
                <tr key={day.date} className="border-b border-gray-100">
                  <td className="py-2 pr-4 whitespace-nowrap">{day.date}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">${day.courtsTotal.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">${day.barTotal.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{day.finalizadas}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{day.canceladas}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{day.noShow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Aviso de que hay más columnas a la derecha (ej. No-show) fuera de la vista en móvil. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
      </div>
    </main>
  );
}
