"use client";

import dynamic from "next/dynamic";
import type { MapOrganization } from "./OrganizationsMap";

// `ssr: false` solo se permite dentro de un Client Component — este wrapper existe únicamente para
// que la home (Server Component) pueda cargar el mapa sin que Leaflet intente tocar `window` en SSR.
const OrganizationsMap = dynamic(() => import("./OrganizationsMap").then((mod) => mod.OrganizationsMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />,
});

export function MapSection({ organizations }: { organizations: MapOrganization[] }) {
  return <OrganizationsMap organizations={organizations} />;
}
