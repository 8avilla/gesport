"use client";

import { useRouter } from "next/navigation";

// El usuario puede llegar acá desde el home del complejo (/{org}) o desde el buscador general (/) —
// un href fijo a /{org} rompía el "volver" cuando venía del buscador. router.back() respeta el
// historial real del navegador, así que vuelve a donde sea que haya entrado. fallbackHref cubre el
// caso de que no haya historial dentro del sitio (link compartido, pestaña nueva).
const DEFAULT_CLASS = "absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700";

export function BackButton({ fallbackHref, className }: { fallbackHref: string; className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      aria-label="Volver"
      className={className ?? DEFAULT_CLASS}
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}
