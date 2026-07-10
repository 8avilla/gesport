"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
};

// Un solo componente cliente (necesita usePathname para el estado activo) usado dos veces: sidebar
// fijo en desktop, barra horizontal deslizable en mobile — mismo dato, dos layouts vía CSS
// responsive en vez de duplicar el árbol de links a mano.
function NavLinks({
  items,
  basePath,
  className,
  linkClassName,
}: {
  items: AdminNavItem[];
  basePath: string;
  className: string;
  linkClassName: (isActive: boolean) => string;
}) {
  const pathname = usePathname();

  return (
    <div className={className}>
      {items.map((item) => {
        const href = `${basePath}${item.href}`;
        const isActive = item.href === "" ? pathname === basePath : pathname.startsWith(href);

        return (
          <Link key={item.href} href={href} className={linkClassName(isActive)}>
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

const BASE_PATH = "/admin";

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const activeClass = "bg-emerald-50 text-emerald-700";
  const inactiveClass = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";

  return (
    <>
      {/* Sidebar fijo en desktop */}
      <NavLinks
        items={items}
        basePath={BASE_PATH}
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-shrink-0 md:flex-col
          md:gap-1 md:overflow-y-auto md:border-r md:border-gray-200 md:bg-white md:p-3"
        linkClassName={(isActive) =>
          `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${isActive ? activeClass : inactiveClass}`
        }
      />

      {/* Barra horizontal en mobile */}
      <div className="relative border-b border-gray-200 bg-white md:hidden">
        <NavLinks
          items={items}
          basePath={BASE_PATH}
          className="flex items-center gap-1 overflow-x-auto px-2 py-2 text-sm"
          linkClassName={(isActive) =>
            `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 font-medium ${
              isActive ? activeClass : inactiveClass
            }`
          }
        />
        {/* Aviso visual de que el menú sigue a la derecha — en móvil el último ítem queda a medio
            cortar y sin esto parece un texto roto en vez de una barra deslizable. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
        />
      </div>
    </>
  );
}
