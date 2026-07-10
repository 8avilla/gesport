import { requireSuperadminSession } from "@/lib/auth/session-guards";
import { logoutAction } from "@/lib/auth-actions";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperadminSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">🌐 Superadmin — todas las organizaciones</p>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{session.user.name}</p>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-gray-500 underline hover:text-gray-700">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
