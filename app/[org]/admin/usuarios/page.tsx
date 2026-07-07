import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUser, updateUser, resetUserPassword } from "@/lib/admin/actions";

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa los datos ingresados (la contraseña debe tener al menos 8 caracteres).",
  email_en_uso: "Ya existe un usuario con ese email.",
  no_autogestion: "No puedes cambiar tu propio rol ni desactivar tu propia cuenta. Pídele a otro administrador que lo haga.",
};

const OK_MESSAGES: Record<string, string> = {
  clave_actualizada: "Contraseña actualizada.",
};

export default async function UsuariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { org: orgSlug } = await params;
  const { error, ok } = await searchParams;

  const session = await auth();
  if (!session?.user || session.user.orgSlug !== orgSlug || session.user.role !== "ADMIN") {
    notFound();
  }

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    notFound();
  }

  const users = await db.user.findMany({ where: { orgId: organization.id }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Usuarios — {organization.name}</h1>

      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{ERROR_MESSAGES[error]}</p>
      )}
      {ok && OK_MESSAGES[ok] && (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{OK_MESSAGES[ok]}</p>
      )}

      <ul className="mt-6 grid gap-3">
        {users.map((user) => {
          const isSelf = user.id === session.user.id;
          return (
            <li key={user.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-medium">
                  {user.name} {isSelf && <span className="text-xs text-gray-400">(tú)</span>}
                </span>
                <span className="text-xs text-gray-500">{user.email}</span>
              </div>

              <form action={updateUser} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="userId" value={user.id} />
                <label className="grid gap-1 text-sm">
                  Rol
                  <select
                    name="role"
                    defaultValue={user.role}
                    disabled={isSelf}
                    className="rounded-md border border-gray-300 px-3 py-3 disabled:bg-gray-100"
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="EMPLOYEE">Empleado</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Estado
                  <select
                    name="active"
                    defaultValue={user.active ? "true" : "false"}
                    disabled={isSelf}
                    className="rounded-md border border-gray-300 px-3 py-3 disabled:bg-gray-100"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={isSelf}
                  className="rounded-md bg-gray-900 px-3 py-3 text-sm text-white disabled:opacity-40"
                >
                  Guardar
                </button>
              </form>

              <form action={resetUserPassword} className="mt-2 flex items-end gap-3">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="userId" value={user.id} />
                <label className="grid gap-1 text-sm">
                  Nueva contraseña
                  <input
                    type="password"
                    name="newPassword"
                    minLength={8}
                    required
                    className="rounded-md border border-gray-300 px-3 py-3"
                  />
                </label>
                <button type="submit" className="rounded-md bg-blue-600 px-3 py-3 text-sm text-white">
                  Resetear contraseña
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <form action={createUser} className="mt-8 grid gap-3 rounded-lg border border-gray-200 p-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <h2 className="text-sm font-medium">Nuevo usuario</h2>
        <label className="grid gap-1 text-sm">
          Nombre
          <input name="name" required minLength={2} className="rounded-md border border-gray-300 px-3 py-3" />
        </label>
        <label className="grid gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Contraseña
          <input
            type="password"
            name="password"
            minLength={8}
            required
            className="rounded-md border border-gray-300 px-3 py-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Rol
          <select name="role" required className="rounded-md border border-gray-300 px-3 py-3">
            <option value="EMPLOYEE">Empleado</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white">
          Crear usuario
        </button>
      </form>
    </main>
  );
}
