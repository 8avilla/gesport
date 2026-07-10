"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./HomeSearch.module.css";

export function SortSelect({
  options,
  selectedSort,
}: {
  options: readonly { value: string; label: string }[];
  selectedSort: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={selectedSort}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) {
          params.set("sort", e.target.value);
        } else {
          params.delete("sort");
        }
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
      }}
      aria-label="Ordenar por"
      className={styles.selectBtn}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
