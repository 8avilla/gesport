import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { logoutAction } from "@/lib/auth-actions";
import { requireAdminSession } from "@/lib/auth/session-guards";
import { AdminNav, type AdminNavItem } from "./AdminNav";

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/reservas", label: "Reservas", icon: "📅" },
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/reportes", label: "Reportes", icon: "📊" },
  { href: "/canchas", label: "Canchas", icon: "🏟️" },
  { href: "/mantenimiento", label: "Mantenimiento", icon: "🛠️" },
  { href: "/inventario", label: "Inventario", icon: "📦" },
  { href: "/clientes", label: "Clientes", icon: "📇" },
  { href: "/caja", label: "Caja", icon: "💰" },
  { href: "/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/auditoria", label: "Auditoría", icon: "🗒️" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, orgSlug } = await requireAdminSession();
  const isSuperadmin = session.user.role === "SUPERADMIN";

  const organization = await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true, name: true } });
  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <AdminNav
        items={NAV_ITEMS}
        userName={session.user.name ?? "?"}
        orgName={organization?.name ?? orgSlug}
        isSuperadmin={isSuperadmin}
        logoutAction={logoutAction}
      />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
