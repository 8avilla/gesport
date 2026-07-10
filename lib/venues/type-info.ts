// Textos/íconos de referencia por tipo de cancha, compartidos entre la página de una cancha y el
// buscador principal. La superficie y los servicios no son datos reales por cancha (no existe ese
// campo en el modelo todavía) — son solo texto de referencia en el frontend hasta que se agregue de
// verdad.
export const VENUE_TYPE_ICON: Record<string, string> = {
  FUTBOL_5: "⚽",
  FUTBOL_8: "⚽",
  PADEL: "🎾",
};

export const VENUE_TYPE_LABEL: Record<string, string> = {
  FUTBOL_5: "Fútbol 5",
  FUTBOL_8: "Fútbol 8",
  PADEL: "Pádel",
};

export const VENUE_TYPE_SURFACE: Record<string, string> = {
  FUTBOL_5: "Grama sintética",
  FUTBOL_8: "Grama sintética",
  PADEL: "Cristal y césped sintético",
};

export const VENUE_TYPE_SERVICES: Record<string, { icon: string; label: string }[]> = {
  FUTBOL_5: [
    { icon: "🅿️", label: "Parqueadero" },
    { icon: "🚻", label: "Baños" },
    { icon: "💡", label: "Iluminación nocturna" },
    { icon: "🥤", label: "Cafetería" },
  ],
  FUTBOL_8: [
    { icon: "🅿️", label: "Parqueadero" },
    { icon: "🚻", label: "Baños" },
    { icon: "💡", label: "Iluminación nocturna" },
    { icon: "🥤", label: "Cafetería" },
  ],
  PADEL: [
    { icon: "🅿️", label: "Parqueadero" },
    { icon: "🚻", label: "Baños" },
    { icon: "💡", label: "Iluminación nocturna" },
    { icon: "🎾", label: "Alquiler de raquetas" },
  ],
};
