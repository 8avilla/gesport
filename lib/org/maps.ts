// Ubicación en Google Maps a partir de las coordenadas guardadas en Organization (ver
// LocationForm/LocationMapPicker en /admin/configuracion) — sin key de Google Maps: el link de
// búsqueda pública y el embed "output=embed" funcionan sin autenticación.
export function getOrgMapsLink(org: { latitude: number | null; longitude: number | null }): string | undefined {
  if (org.latitude == null || org.longitude == null) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${org.latitude},${org.longitude}`;
}

export function getOrgMapEmbedSrc(org: { latitude: number | null; longitude: number | null }): string | undefined {
  if (org.latitude == null || org.longitude == null) return undefined;
  return `https://www.google.com/maps?q=${org.latitude},${org.longitude}&z=15&output=embed`;
}
