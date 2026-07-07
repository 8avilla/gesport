import divipola from "divipola";

// El paquete `divipola` trae dos nombres con un punto en vez de coma por un error de origen.
const NAME_FIXES: Record<string, string> = {
  "BOGOTÁ. D.C.": "BOGOTÁ, D.C.",
  "ARCHIPIÉLAGO DE SAN ANDRÉS. PROVIDENCIA Y SANTA CATALINA":
    "ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA",
};

function fixName(name: string): string {
  return NAME_FIXES[name] ?? name;
}

const MUNICIPIOS_BY_DEPARTAMENTO = new Map<string, string[]>();

for (const entry of divipola) {
  const departamento = fixName(entry.deptoName);
  const municipio = fixName(entry.mpioName);
  const municipios = MUNICIPIOS_BY_DEPARTAMENTO.get(departamento) ?? [];
  municipios.push(municipio);
  MUNICIPIOS_BY_DEPARTAMENTO.set(departamento, municipios);
}

for (const municipios of MUNICIPIOS_BY_DEPARTAMENTO.values()) {
  municipios.sort((a, b) => a.localeCompare(b, "es"));
}

export const DEPARTAMENTOS: readonly string[] = [...MUNICIPIOS_BY_DEPARTAMENTO.keys()].sort((a, b) =>
  a.localeCompare(b, "es"),
);

export function getMunicipios(departamento: string): readonly string[] {
  return MUNICIPIOS_BY_DEPARTAMENTO.get(departamento) ?? [];
}

export function isValidMunicipio(departamento: string, municipio: string): boolean {
  return getMunicipios(departamento).includes(municipio);
}
