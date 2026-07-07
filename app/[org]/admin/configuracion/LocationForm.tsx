"use client";

import { useState } from "react";
import { updateOrganizationLocation } from "@/lib/admin/actions";
import { DEPARTAMENTOS, getMunicipios } from "@/lib/data/colombia";

export function LocationForm({
  orgSlug,
  initialDepartment,
  initialMunicipality,
}: {
  orgSlug: string;
  initialDepartment: string | null;
  initialMunicipality: string | null;
}) {
  const [department, setDepartment] = useState(initialDepartment ?? "");
  const municipios = department ? getMunicipios(department) : [];
  const municipalityDefault = department === initialDepartment ? (initialMunicipality ?? "") : "";

  return (
    <form action={updateOrganizationLocation} className="mt-6 grid gap-4 rounded-lg border border-gray-200 p-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />

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

      <button
        type="submit"
        className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800"
      >
        Guardar ubicación
      </button>
    </form>
  );
}
