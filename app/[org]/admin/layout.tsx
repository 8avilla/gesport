import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "", label: "Dashboard" },
  { href: "/reportes", label: "Reportes" },
  { href: "/canchas", label: "Canchas" },
  { href: "/mantenimiento", label: "Mantenimiento" },
  { href: "/inventario", label: "Inventario" },
  { href: "/reservas", label: "Reservas" },
  { href: "/caja", label: "Caja" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/configuracion", label: "Configuración" },
];

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;

  const session = await auth();
  if (!session?.user || session.user.orgSlug !== orgSlug || session.user.role !== "ADMIN") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="relative border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 overflow-x-auto px-4 py-3 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={`/${orgSlug}/admin${item.href}`}
              className="shrink-0 whitespace-nowrap text-gray-600 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
        {/* Aviso visual de que el menú sigue a la derecha — en móvil el último ítem queda a medio
            cortar y sin esto parece un texto roto en vez de una barra deslizable. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
      </nav>
      {children}
    </div>
  );
}
