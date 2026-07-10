"use client";

import "leaflet/dist/leaflet.css";
import type { Marker as LeafletMarker } from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { createPinIcon } from "@/app/components/map-pin-icon";

const pinIcon = createPinIcon({ label: "🏟️" });

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Mapa interactivo para que el admin marque el punto exacto del complejo — el departamento/municipio
// del formulario solo ubica la región, no alcanza para poner un pin preciso en el buscador principal.
export function LocationMapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} className="h-56 w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as LeafletMarker;
              const { lat: newLat, lng: newLng } = marker.getLatLng();
              onChange(newLat, newLng);
            },
          }}
        />
        <ClickToMove onMove={onChange} />
      </MapContainer>
    </div>
  );
}
