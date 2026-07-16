"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createRecurringBooking } from "@/lib/admin/actions";
import { buildWeeklyOccurrenceDates, MAX_RECURRING_OCCURRENCES } from "@/lib/booking/recurrence";
import { buildQuickDateOptions } from "@/lib/time/business-day";
import { SubmitButton } from "@/app/components/SubmitButton";

// Espejo de OPENING_HOUR/CLOSING_HOUR (lib/booking/availability.ts) — no se importa directo porque
// ese módulo trae `db` (Prisma) y este es un client component; son los mismos valores (8-23), el
// servidor vuelve a validar el rango real al crear la reserva.
const OPENING_HOUR = 8;
const CLOSING_HOUR = 23;
const HOUR_OPTIONS = Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, i) =>
  `${String(OPENING_HOUR + i).padStart(2, "0")}:00`,
);

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const BOOKING_TYPE_LABEL: Record<string, string> = { PARTICULAR: "Particular", TORNEO: "Torneo", CLASE: "Clase" };

function addHour(time: string): string {
  const hour = Number(time.slice(0, 2));
  return `${String(hour + 1).padStart(2, "0")}:00`;
}

// "YYYY-MM-DD" -> índice de día de semana, evaluado a mediodía para no cruzar de día por el offset
// de zona horaria del navegador (solo se usa para mostrar la etiqueta del día, no para calcular
// las ocurrencias reales — eso lo hace el servidor con businessDayStart, sin ambigüedad de TZ).
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00`).getDay();
}

const STEPS = ["Detalles de la reserva", "Repetición", "Confirmación"];

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-500";

interface VenueOption {
  id: string;
  name: string;
  hourlyRate: number;
}

export function RecurrenceWizard({ venues, todayIso }: { venues: VenueOption[]; todayIso: string }) {
  const quickDateOptions = useMemo(() => buildQuickDateOptions(todayIso), [todayIso]);
  const [step, setStep] = useState(1);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [bookingType, setBookingType] = useState("PARTICULAR");
  const [notes, setNotes] = useState("");
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [endDate, setEndDate] = useState("");

  const selectedVenue = venues.find((v) => v.id === venueId);
  const endTime = addHour(startTime);
  const selectedWeekday = startDate ? weekdayOf(startDate) : null;

  const occurrenceDates = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    return buildWeeklyOccurrenceDates(startDate, endDate);
  }, [startDate, endDate]);

  const tooManyOccurrences = occurrenceDates.length > MAX_RECURRING_OCCURRENCES;
  const totalEstimate = occurrenceDates.length * (selectedVenue?.hourlyRate ?? 0);

  const step1Valid = venueId && customerName.trim().length >= 2 && customerPhone.trim().length >= 7 && startDate;
  const step2Valid = step1Valid && endDate && !tooManyOccurrences && occurrenceDates.length > 0;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        {/* Indicador de pasos */}
        <div className="flex items-center">
          {STEPS.map((label, index) => {
            const num = index + 1;
            const state = num < step ? "done" : num === step ? "active" : "pending";
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      state === "done"
                        ? "bg-emerald-700 text-white"
                        : state === "active"
                          ? "bg-emerald-700 text-white ring-4 ring-emerald-100"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {state === "done" ? "✓" : num}
                  </div>
                  <span
                    className={`whitespace-nowrap text-xs font-medium ${
                      state === "pending" ? "text-gray-400" : "text-gray-700"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {num < STEPS.length && (
                  <div className={`mx-2 h-0.5 flex-1 ${num < step ? "bg-emerald-700" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Detalles de la reserva</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Cancha *
                <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className={INPUT_CLASS}>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Tipo de reserva
                <select value={bookingType} onChange={(e) => setBookingType(e.target.value)} className={INPUT_CLASS}>
                  {Object.entries(BOOKING_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Cliente *
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  minLength={2}
                  placeholder="Nombre"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Teléfono *
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  minLength={7}
                  placeholder="3001234567"
                  className={INPUT_CLASS}
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Fecha de inicio *
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {quickDateOptions.map((option) => (
                    <button
                      key={option.date}
                      type="button"
                      onClick={() => setStartDate(option.date)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        startDate === option.date
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm shadow-sm
                    focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Hora inicio *
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT_CLASS}>
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Duración
                <select disabled value="1" className={`${INPUT_CLASS} bg-gray-50 text-gray-500`}>
                  <option value="1">1 hora</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Hora fin
                <input readOnly value={endTime} className={`${INPUT_CLASS} bg-gray-50 text-gray-500`} />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Estado
                <select disabled value="CONFIRMADA" className={`${INPUT_CLASS} bg-gray-50 text-emerald-700`}>
                  <option value="CONFIRMADA">Confirmada</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Método de pago
                <select
                  value={requiresDeposit ? "abono" : "cancha"}
                  onChange={(e) => setRequiresDeposit(e.target.value === "abono")}
                  className={INPUT_CLASS}
                >
                  <option value="cancha">Pago en cancha</option>
                  <option value="abono">Pago anticipado (abono)</option>
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Precio por hora
                <input
                  readOnly
                  value={selectedVenue ? `$${selectedVenue.hourlyRate.toLocaleString("es-CO")}` : "—"}
                  className={`${INPUT_CLASS} bg-gray-50 text-gray-500`}
                />
              </label>

              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Notas (opcional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej. Partido de torneo semanal…"
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Configuración de repetición</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-[200px_1fr]">
              <div className="grid gap-2">
                <RepeatOption label="No repetir" description="Usa “Nueva reserva” para una sola vez" />
                <RepeatOption label="Diaria" description="Se repite todos los días" />
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-emerald-600 bg-emerald-50 p-2.5">
                  <input type="radio" checked readOnly className="mt-0.5 accent-emerald-700" />
                  <span>
                    <span className="block text-sm font-medium text-emerald-800">Semanal</span>
                    <span className="block text-xs text-emerald-700">Se repite cada semana</span>
                  </span>
                </label>
                <RepeatOption label="Cada 15 días" description="Se repite cada 2 semanas" />
                <RepeatOption label="Mensual" description="Se repite cada mes" />
                <RepeatOption label="Personalizada" description="Configuración avanzada" />
              </div>

              <div className="grid gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-700">Repetir cada</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      disabled
                      value="1"
                      className="w-16 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                    <span className="text-sm text-gray-500">semana(s)</span>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Días de la semana</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, index) => {
                      const isImplied = selectedWeekday === index;
                      return (
                        <span
                          key={label}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                            isImplied
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-gray-50 text-gray-300"
                          }`}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Se repite el mismo día de la semana que la fecha de inicio.
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Fecha de finalización</span>
                  <div className="mt-1 grid gap-2">
                    <label className="flex cursor-not-allowed items-center gap-2 text-sm text-gray-400">
                      <input type="radio" disabled className="accent-gray-300" />
                      Sin fecha de finalización
                      <ProximamentePill />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" checked readOnly className="accent-emerald-700" />
                      Hasta el
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="flex cursor-not-allowed items-center gap-2 text-sm text-gray-400">
                      <input type="radio" disabled className="accent-gray-300" />
                      Después de N ocurrencias
                      <ProximamentePill />
                    </label>
                  </div>
                </div>

                {tooManyOccurrences && (
                  <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                    Ese rango genera {occurrenceDates.length} ocurrencias — el máximo es {MAX_RECURRING_OCCURRENCES}{" "}
                    (52 semanas). Acorta el rango.
                  </p>
                )}

                {startDate && endDate && !tooManyOccurrences && occurrenceDates.length > 0 && (
                  <p className="rounded-md bg-gray-50 p-2.5 text-xs text-gray-600">
                    ℹ️ Se crearán reservas todos los {DAY_LABELS[weekdayOf(startDate)]} a las {startTime} hasta el{" "}
                    {endDate}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <form action={createRecurringBooking} className="mt-8 grid gap-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Confirmación</h2>
            <p className="text-sm text-gray-500">
              Revisa los datos antes de crear la serie. Se generarán {occurrenceDates.length} reserva(s), todas ya
              confirmadas.
            </p>

            <input type="hidden" name="venueId" value={venueId} />
            <input type="hidden" name="customerName" value={customerName} />
            <input type="hidden" name="customerPhone" value={customerPhone} />
            <input type="hidden" name="startDate" value={startDate} />
            <input type="hidden" name="endDate" value={endDate} />
            <input type="hidden" name="startTime" value={startTime} />
            <input type="hidden" name="endTime" value={endTime} />
            <input type="hidden" name="bookingType" value={bookingType} />
            <input type="hidden" name="notes" value={notes} />
            {requiresDeposit && <input type="hidden" name="requiresDeposit" value="on" />}

            <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Atrás
              </button>
              <SubmitButton
                pendingLabel="Creando…"
                disabled={occurrenceDates.length === 0}
                className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Crear reserva recurrente
              </SubmitButton>
              <Link href="/admin/reservas" className="ml-auto text-sm text-gray-500 hover:underline">
                Cancelar
              </Link>
            </div>
          </form>
        )}

        {step < 3 && (
          <div className="mt-5 flex items-center gap-3">
            <Link
              href="/admin/reservas"
              className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Link>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Atrás
              </button>
            )}
            <button
              type="button"
              disabled={step === 1 ? !step1Valid : !step2Valid}
              onClick={() => setStep(step + 1)}
              className="ml-auto rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800
                disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar →
            </button>
          </div>
        )}
      </div>

      {/* Columna lateral: resumen + vista previa, visible en los 3 pasos */}
      <div className="grid content-start gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Resumen de la reserva</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <SummaryRow label="🏟️ Cancha" value={selectedVenue?.name ?? "—"} />
            <SummaryRow label="👤 Cliente" value={customerName || "—"} />
            <SummaryRow label="📱 Teléfono" value={customerPhone || "—"} />
            <SummaryRow label="📅 Fecha inicio" value={startDate || "—"} />
            <SummaryRow label="🕒 Hora" value={`${startTime} - ${endTime}`} />
            <SummaryRow label="🔁 Repetición" value={startDate ? `Cada semana los ${DAY_LABELS[weekdayOf(startDate)]}` : "—"} />
            <SummaryRow label="🏁 Fecha fin" value={endDate || "—"} />
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Vista previa de ocurrencias</h3>
          {occurrenceDates.length === 0 ? (
            <p className="mt-2 text-xs text-gray-400">Completa fecha de inicio y fin para ver las ocurrencias.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm text-gray-700">
              {occurrenceDates.slice(0, 4).map((date) => (
                <li key={date} className="flex items-center gap-2">
                  <span aria-hidden="true">📅</span>
                  {date} · {startTime}-{endTime}
                </li>
              ))}
              {occurrenceDates.length > 4 && <li className="text-gray-400">…</li>}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-400">Total: {occurrenceDates.length} ocurrencias</p>
        </div>

        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="text-sm font-medium text-emerald-700">Total estimado</div>
          <div className="text-2xl font-bold text-emerald-800">${totalEstimate.toLocaleString("es-CO")}</div>
          <div className="text-xs text-emerald-600">{occurrenceDates.length} ocurrencias</div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="truncate font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function ProximamentePill() {
  return (
    <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
      Próximamente
    </span>
  );
}

function RepeatOption({ label, description }: { label: string; description: string }) {
  return (
    <label
      title="Próximamente"
      className="flex cursor-not-allowed items-start gap-2 rounded-md border border-gray-200 p-2.5 opacity-60"
    >
      <input type="radio" disabled className="mt-0.5 accent-gray-300" />
      <span>
        <span className="block text-sm font-medium text-gray-500">{label}</span>
        <span className="block text-xs text-gray-400">{description}</span>
      </span>
      <ProximamentePill />
    </label>
  );
}
