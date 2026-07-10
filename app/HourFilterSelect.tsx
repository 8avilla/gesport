"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./HomeSearch.module.css";

// Select de hora específica (no franjas Mañana/Tarde/Noche) — filtra canchas con ese horario exacto
// libre hoy. Un <select> nativo navega solo con onChange, sin necesitar un botón "Buscar" aparte.
export function HourFilterSelect({ hours, selectedHour }: { hours: string[]; selectedHour: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("hora", value);
    } else {
      params.delete("hora");
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <select
      value={selectedHour}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Filtrar por hora específica"
      className={styles.control}
    >
      <option value="">Cualquier hora</option>
      {hours.map((hour) => (
        <option key={hour} value={hour}>
          {hour}
        </option>
      ))}
    </select>
  );
}
