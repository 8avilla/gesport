import { db } from "@/lib/db";
import { createOrganization, selectAdminOrg } from "@/lib/superadmin/actions";

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos:
    "Revisa los datos (el slug solo puede tener minúsculas, números y guiones; la contraseña, 8+ caracteres).",
  email_en_uso: "Ya existe un usuario con ese email.",
  slug_en_uso: "Ya existe una organización con ese slug.",
};

const OK_MESSAGES: Record<string, string> = {
  organizacion_creada: "Organización creada, con su primer usuario administrador.",
};

export default async function SuperadminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { venues: true, users: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold">Organizaciones</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{ERROR_MESSAGES[error]}</p>
      )}
      {ok && OK_MESSAGES[ok] && (
        <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{OK_MESSAGES[ok]}</p>
      )}

      <ul className="mt-6 grid gap-3">
        {organizations.map((org) => (
          <li key={org.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="font-medium text-gray-900">{org.name}</span>
              <span className="text-xs text-gray-500">/{org.slug}</span>
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {org._count.venues} {org._count.venues === 1 ? "cancha" : "canchas"} · {org._count.users}{" "}
              {org._count.users === 1 ? "usuario" : "usuarios"}
            </div>
            <form action={selectAdminOrg} className="mt-2 inline-block">
              <input type="hidden" name="orgSlug" value={org.slug} />
              <button type="submit" className="text-sm text-emerald-700 underline">
                Entrar al panel
              </button>
            </form>
          </li>
        ))}

        {organizations.length === 0 && <li className="text-sm text-gray-500">Todavía no hay organizaciones.</li>}
      </ul>

      <form action={createOrganization} className="mt-8 grid gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700">Nueva organización</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nombre del negocio
            <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-2.5" />
          </label>
          <label className="grid gap-1 text-sm">
            Slug (URL)
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="mi-negocio"
              className="rounded-md border border-gray-300 px-3 py-2.5"
            />
          </label>
        </div>

        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-400">Primer administrador</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nombre
            <input name="adminName" required minLength={2} className="rounded-md border border-gray-300 px-3 py-2.5" />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <input
              type="email"
              name="adminEmail"
              required
              className="rounded-md border border-gray-300 px-3 py-2.5"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Contraseña
            <input
              type="password"
              name="adminPassword"
              required
              minLength={8}
              className="rounded-md border border-gray-300 px-3 py-2.5"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Crear organización
        </button>
      </form>
    </main>
  );
}
