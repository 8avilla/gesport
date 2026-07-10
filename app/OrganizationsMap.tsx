"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { createPinIcon } from "@/app/components/map-pin-icon";

export type MapOrganization = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  latitude: number;
  longitude: number;
  venueCount: number;
};

function FitToMarkers({ organizations }: { organizations: MapOrganization[] }) {
  const map = useMap();

  useEffect(() => {
    if (organizations.length === 1) {
      map.setView([organizations[0].latitude, organizations[0].longitude], 14);
      return;
    }
    const bounds = organizations.map((org) => [org.latitude, org.longitude] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, organizations]);

  return null;
}

// Mini logo dentro del pin cuando existe, para que el mapa se sienta parte del mismo ecosistema
// visual que las cards de resultados en vez de un mapa administrativo genérico.
function pinIconFor(org: MapOrganization) {
  return createPinIcon({ label: org.name.charAt(0).toUpperCase() });
}

export function OrganizationsMap({ organizations }: { organizations: MapOrganization[] }) {
  const center: [number, number] = [organizations[0].latitude, organizations[0].longitude];

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToMarkers organizations={organizations} />
      {organizations.map((org) => (
        <Marker key={org.id} position={[org.latitude, org.longitude]} icon={pinIconFor(org)}>
          <Popup>
            <div className="flex min-w-[10rem] items-center gap-2">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo subido por el admin como URL externa
                <img src={org.logoUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                <p className="text-xs text-gray-500">
                  {org.venueCount} {org.venueCount === 1 ? "cancha disponible" : "canchas disponibles"}
                </p>
              </div>
            </div>
            <Link href={`/${org.slug}`} className="mt-2 block text-center text-xs font-semibold text-emerald-700">
              Ver canchas →
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
