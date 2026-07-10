"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./HomeSearch.module.css";

export function TypeFilterSelect({
  options,
  selectedType,
}: {
  options: { value: string; label: string }[];
  selectedType: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={selectedType}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) {
          params.set("type", e.target.value);
        } else {
          params.delete("type");
        }
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
      }}
      aria-label="Filtrar por tipo de cancha"
      className={styles.control}
    >
      {options.map((opt) => (
        <option key={opt.value || "all"} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
