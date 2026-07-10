import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/session-guards";

const STATUS_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_DISPUTA: "En disputa",
  CERRADO: "Cerrado",
};

// El acceso (ADMIN de esta org, o SUPERADMIN) ya lo garantiza app/admin/layout.tsx — no hace falta
// repetir el chequeo acá (y repetirlo a mano es justo lo que dejaba a SUPERADMIN afuera antes).
export default async function CajaAdminPage() {
  const { orgSlug } = await requireAdminSession();

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const shifts = await db.cashShift.findMany({
    where: { orgId: organization.id },
    include: { employee: true },
    orderBy: { openedAt: "desc" },
    take: 30,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Turnos de caja — {organization.name}</h1>

      <ul className="mt-6 grid gap-3">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{shift.employee.name}</span>
              <span
                className={
                  shift.status === "EN_DISPUTA" ? "text-sm font-medium text-red-600" : "text-sm text-gray-500"
                }
              >
                {STATUS_LABEL[shift.status] ?? shift.status}
              </span>
            </div>
            <div className="text-sm text-gray-500">{shift.openedAt.toLocaleString("es-CO")}</div>
            <Link
              href={`/admin/caja/${shift.id}`}
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              Ver detalle
            </Link>
          </li>
        ))}

        {shifts.length === 0 && <li className="text-sm text-gray-500">Sin turnos registrados todavía.</li>}
      </ul>
    </main>
  );
}
