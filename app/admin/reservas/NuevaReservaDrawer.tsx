"use client";

import { useRef, useState } from "react";
import { createBooking, searchCustomers, type CustomerSuggestion } from "@/lib/admin/actions";
import { CLOSING_HOUR, OPENING_HOUR } from "@/lib/booking/availability";
import { resolveVenuePrice, type VenuePriceRuleLike } from "@/lib/booking/pricing";
import { SubmitButton } from "@/app/components/SubmitButton";

export interface VenueForBooking {
  id: string;
  name: string;
  hourlyRate: number;
  priceRules: VenuePriceRuleLike[];
}

const HOUR_OPTIONS = Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) =>
  `${String(OPENING_HOUR + i).padStart(2, "0")}:00`,
);

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa el nombre del cliente (solo letras) y, si escribiste un teléfono, que tenga 10 dígitos.",
  cupo_no_disponible: "Ese horario ya está ocupado en esa cancha — elige otra hora o cancha.",
};

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

export function NuevaReservaDrawer({
  venues,
  defaultDate,
  defaultVenueId,
  defaultStartTime,
  onClose,
  error,
}: {
  venues: VenueForBooking[];
  defaultDate: string;
  // Prefill al abrir el drawer desde una celda "+ Libre" del grid de agenda (AgendaGrid.tsx) — el
  // admin no tiene que volver a elegir cancha/hora que ya seleccionó al hacer clic ahí.
  defaultVenueId?: string;
  defaultStartTime?: string;
  onClose: () => void;
  error?: string;
}) {
  const [venueId, setVenueId] = useState(defaultVenueId ?? venues[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStartTime ?? "");
  const selectedVenue = venues.find((v) => v.id === venueId);
  // Precio real de la tarifa (incluye excepciones por día/hora, ver resolveVenuePrice) — se recalcula
  // solo mientras el admin no haya tocado el campo a mano (totalManuallyEdited); apenas lo edita una
  // vez, su valor manda y deja de seguir los cambios de cancha/fecha/hora.
  const computedPrice = selectedVenue
    ? startTime
      ? resolveVenuePrice(selectedVenue, selectedVenue.priceRules, date, startTime)
      : selectedVenue.hourlyRate
    : 0;

  // Estado de pago derivado automáticamente del abono, no elegido a mano: 0 = sin pago, entre 0 y el
  // precio = abonada, igual o más que el precio = pagada (el abono nunca puede superar el precio, se
  // topa al guardar — ver createBooking en lib/admin/actions.ts).
  const [depositInput, setDepositInput] = useState("0");
  const [totalInput, setTotalInput] = useState("");
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false);
  const effectiveTotal = totalManuallyEdited ? Number(totalInput) || 0 : computedPrice;
  const depositNum = Number(depositInput) || 0;
  const paymentLabel = depositNum <= 0 ? "Sin pago" : depositNum >= effectiveTotal ? "Pagada" : "Abonada";
  const paymentBadgeClass =
    paymentLabel === "Sin pago"
      ? "bg-gray-100 text-gray-700"
      : paymentLabel === "Pagada"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-amber-50 text-amber-700";

  // Autocompletar de "Cliente": busca entre quienes ya reservaron en esta organización mientras el
  // admin escribe, para no tener que volver a digitar nombre/teléfono de un cliente conocido — si no
  // existe, se crea solo al guardar la reserva (ver createBooking, lib/admin/actions.ts).
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  function handleNameChange(value: string) {
    setNameInput(value);
    setShowSuggestions(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const seq = ++searchSeq.current;
    searchTimeout.current = setTimeout(async () => {
      const results = await searchCustomers(value);
      if (seq === searchSeq.current) setSuggestions(results);
    }, 250);
  }

  function pickSuggestion(suggestion: CustomerSuggestion) {
    setNameInput(suggestion.name);
    setPhoneInput(suggestion.phone);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  return (
    <>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="fixed inset-0 z-40 bg-black/40" />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Nueva reserva</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {error && ERROR_MESSAGES[error] && (
          <p className="mx-6 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{ERROR_MESSAGES[error]}</p>
        )}

        <form action={createBooking} className="grid gap-4 px-6 py-5">
          <label className="text-sm font-medium text-gray-700">
            Cancha *
            <select
              name="venueId"
              required
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Selecciona una cancha
              </option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">
              Fecha *
              <input
                type="date"
                name="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Hora inicio *
              <select
                name="startTime"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="" disabled>
                  Elige la hora
                </option>
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Duración
            {/* Duración fija en 1 hora — igual que el resto del sistema (ver plan: ningún flujo de
                reserva soporta hoy turnos de varias horas). */}
            <select disabled defaultValue="1" className={`${INPUT_CLASS} bg-gray-50 text-gray-500`}>
              <option value="1">1 hora</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="relative text-sm font-medium text-gray-700">
              Cliente *
              <input
                type="text"
                name="customerName"
                required
                minLength={2}
                placeholder="Nombre"
                autoComplete="off"
                value={nameInput}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className={INPUT_CLASS}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.phone}>
                      <button
                        type="button"
                        onClick={() => pickSuggestion(suggestion)}
                        className="block w-full px-3 py-2 text-left text-sm font-normal text-gray-700 hover:bg-gray-50"
                      >
                        <span className="block font-medium text-gray-900">{suggestion.name}</span>
                        <span className="block text-xs text-gray-500">{suggestion.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <label className="text-sm font-medium text-gray-700">
              Teléfono
              <input
                type="tel"
                name="customerPhone"
                placeholder="3001234567 (opcional)"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Precio de esta reserva
            <input
              type="number"
              inputMode="numeric"
              name="totalAmount"
              min={0}
              value={totalManuallyEdited ? totalInput : String(computedPrice)}
              onChange={(e) => {
                setTotalManuallyEdited(true);
                setTotalInput(e.target.value);
              }}
              className={INPUT_CLASS}
            />
            <span className="mt-1 block text-xs text-gray-400">
              Se calcula solo según la tarifa de la cancha (incluye excepciones de precio si aplican) — edítalo si
              necesitas ajustarlo para esta reserva.
            </span>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Abono recibido
            <input
              type="number"
              inputMode="numeric"
              name="depositAmount"
              min={0}
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              className={INPUT_CLASS}
            />
            <span className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              El estado de pago se calcula solo: $0 → sin pago, menos que el precio → abonada, el precio completo
              (o más) → pagada.
            </span>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${paymentBadgeClass}`}>
              Queda como: {paymentLabel}
            </span>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Soporte de pago (opcional)
            <input
              type="file"
              name="receipt"
              accept="image/*,application/pdf"
              className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
            />
          </label>

          <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-4">
            <SubmitButton
              pendingLabel="Creando…"
              className="flex-1 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Crear reserva
            </SubmitButton>
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:underline">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
