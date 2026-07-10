import L from "leaflet";

// Pin propio en vez del ícono azul por defecto de Leaflet (que además requiere cargar imágenes
// externas que el bundler de Next no resuelve solo) — mantiene el mapa dentro de la paleta
// emerald del design system en vez de romper la identidad visual con un marker genérico.
export function createPinIcon({ label, size = 34 }: { label?: string; size?: number } = {}) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;height:${size}px;
        display:flex;align-items:center;justify-content:center;
        background:#047857;color:#fff;
        border:2px solid #fff;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        font-size:${size * 0.4}px;font-weight:600;font-family:inherit;
      ">
        <span style="transform:rotate(45deg);">${label ?? "📍"}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}
