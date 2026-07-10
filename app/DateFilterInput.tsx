"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./HomeSearch.module.css";

// Input de fecha nativo para el buscador — a diferencia de DateJumpInput (que navega a una página de
// cancha puntual), este conserva el resto de filtros activos (q, type, hora) en la URL.
export function DateFilterInput({ selectedDateIso }: { selectedDateIso: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <input
      type="date"
      value={selectedDateIso}
      onChange={(e) => {
        if (!e.target.value) {
          return;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("fecha", e.target.value);
        router.push(`/?${params.toString()}`);
      }}
      aria-label="Filtrar por fecha"
      className={styles.control}
    />
  );
}
