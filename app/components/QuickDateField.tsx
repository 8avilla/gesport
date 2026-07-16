"use client";

import { useState } from "react";
import type { QuickDateOption } from "@/lib/time/business-day";

// Input de fecha con chips de acceso rápido (Hoy, Mañana, Vie 17...) arriba del datepicker nativo —
// las reservas del admin casi siempre son a pocos días de anticipación, así que esto evita abrir el
// calendario nativo y navegar mes a mes para el caso común. El input nativo sigue ahí como respaldo
// para fechas más lejanas.
export function QuickDateField({
  name,
  defaultValue,
  options,
  required,
}: {
  name: string;
  defaultValue: string;
  options: QuickDateOption[];
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.date}
            type="button"
            onClick={() => setValue(option.date)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              value === option.date
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        name={name}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500
          focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}
