"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { HourSlot } from "@/lib/booking/availability";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const GROUPS: { label: string; icon: string; test: (hour: number) => boolean }[] = [
  { label: "Mañana", icon: "☀️", test: (h) => h < 12 },
  { label: "Tarde", icon: "🌤️", test: (h) => h >= 12 && h < 18 },
  { label: "Noche", icon: "🌙", test: (h) => h >= 18 },
];

function groupSlots(slots: HourSlot[]) {
  return GROUPS.map((group) => ({
    ...group,
    slots: slots.filter((slot) => group.test(Number(slot.startTime.slice(0, 2)))),
  })).filter((group) => group.slots.length > 0);
}

// Sincronización en vivo (Fase 5): sondea cada pocos segundos en vez de Change Streams de Mongo —
// para el volumen de esta app es igual de efectivo y no requiere mantener conexiones abiertas por
// servidor. Si el tráfico crece mucho, esto es lo primero que se cambiaría por SSE + Change Streams.
export function AvailabilityGrid({
  orgSlug,
  venueId,
  dateIso,
  hourlyRate,
  initialSlots,
}: {
  orgSlug: string;
  venueId: string;
  dateIso: string;
  hourlyRate: number;
  initialSlots: HourSlot[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<HourSlot | null>(null);

  const { data } = useSWR<{ slots: HourSlot[] }>(
    `/api/${orgSlug}/venues/${venueId}/availability?date=${dateIso}`,
    fetcher,
    { fallbackData: { slots: initialSlots }, refreshInterval: 5000, revalidateOnFocus: true },
  );

  const slots = data?.slots ?? initialSlots;
  const availableCount = slots.filter((slot) => slot.available).length;
  const groups = groupSlots(slots);

  function handleContinue() {
    if (!selected) return;
    router.push(
      `/${orgSlug}/${venueId}/reservar?date=${dateIso}&start=${selected.startTime}&end=${selected.endTime}`,
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Disponible
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" /> Seleccionado
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-300" /> Ocupado
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> Mantenimiento
        </span>
      </div>

      {availableCount === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
          <div className="text-2xl">👀</div>
          <p className="mt-2">No quedan horarios libres este día.</p>
          <p className="text-gray-400">Prueba otra fecha arriba ☝️</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-4">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-gray-700">
                {group.icon} {group.label}
              </h3>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.slots.map((slot) => {
                  const isSelected = selected?.startTime === slot.startTime;

                  if (!slot.available) {
                    return (
                      <span
                        key={slot.startTime}
                        className={`rounded-lg border py-3 text-center text-sm ${
                          slot.blockedReason === "mantenimiento"
                            ? "border-amber-200 bg-amber-50 text-amber-600"
                            : "border-gray-100 bg-gray-50 text-gray-300 line-through"
                        }`}
                      >
                        {slot.startTime}
                      </span>
                    );
                  }

                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setSelected(slot)}
                      className={`rounded-lg border py-3 text-center text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-100"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium text-gray-900">
                {dateIso} · {selected.startTime} - {selected.endTime}
              </div>
              <div className="text-gray-500">${hourlyRate.toLocaleString("es-CO")}</div>
            </div>
            <button
              type="button"
              onClick={handleContinue}
              className="flex-shrink-0 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {selected && <div className="h-20" aria-hidden />}
    </div>
  );
}
