"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { updateOrganizationLocation } from "@/lib/admin/actions";
import { DEPARTAMENTOS, getMunicipios } from "@/lib/data/colombia";

// Leaflet toca `window` al importarse, así que el picker solo puede vivir en el cliente.
const LocationMapPicker = dynamic(
  () => import("./LocationMapPicker").then((mod) => mod.LocationMapPicker),
  { ssr: false, loading: () => <div className="h-56 w-full animate-pulse rounded-lg bg-gray-100" /> },
);

// Centro de Colombia (Bogotá) como punto de partida cuando el complejo todavía no tiene pin propio.
const DEFAULT_LAT = 4.711;
const DEFAULT_LNG = -74.0721;

export function LocationForm({
  initialDepartment,
  initialMunicipality,
  initialLatitude,
  initialLongitude,
}: {
  initialDepartment: string | null;
  initialMunicipality: string | null;
  initialLatitude: number | null;
  initialLongitude: number | null;
}) {
  const [department, setDepartment] = useState(initialDepartment ?? "");
  const municipios = department ? getMunicipios(department) : [];
  const municipalityDefault = department === initialDepartment ? (initialMunicipality ?? "") : "";
  const [lat, setLat] = useState(initialLatitude ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLongitude ?? DEFAULT_LNG);

  return (
    <form action={updateOrganizationLocation} className="mt-6 grid gap-4 rounded-lg border border-gray-200 p-4">
      <label className="grid gap-1 text-sm">
        País
        <input
          type="text"
          value="Colombia"
          disabled
          className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500"
        />
      </label>

      <label className="grid gap-1 text-sm">
        Departamento
        <select
          name="department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="" disabled>
            Selecciona un departamento
          </option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        Municipio
        <select
          name="municipality"
          defaultValue={municipalityDefault}
          key={department}
          required
          disabled={!department}
          className="rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="" disabled>
            {department ? "Selecciona un municipio" : "Selecciona primero un departamento"}
          </option>
          {municipios.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-1 text-sm">
        <span>Punto exacto en el mapa</span>
        <p className="text-xs text-gray-500">Arrastra el pin o toca el mapa para marcar la entrada del complejo.</p>
        <LocationMapPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
        />
      </div>
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />

      <button
        type="submit"
        className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800"
      >
        Guardar ubicación
      </button>
    </form>
  );
}
