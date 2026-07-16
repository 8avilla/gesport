import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { todayBusinessDate } from "@/lib/time/business-day";
import { RecurrenceWizard } from "./RecurrenceWizard";

export default async function RecurringBookingWizardPage() {
  const { orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const venues = await db.venue.findMany({
    where: { orgId: organization.id, status: "ACTIVA" },
    orderBy: { name: "asc" },
  });

  return (
    <main className="px-6 py-10">
      <Link href="/admin/reservas" className="text-sm text-gray-500 hover:underline">
        ← Volver a reservas
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-gray-900">Nueva reserva recurrente</h1>
      <p className="mt-1 text-sm text-gray-500">Crea reservas que se repiten automáticamente en el tiempo.</p>

      {venues.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
          Crea primero una cancha activa para poder reservar.
        </p>
      ) : (
        <RecurrenceWizard
          venues={venues.map((v) => ({ id: v.id, name: v.name, hourlyRate: v.hourlyRate }))}
          todayIso={todayBusinessDate()}
        />
      )}
    </main>
  );
}
