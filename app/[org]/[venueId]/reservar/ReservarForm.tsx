"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  createBookingShell,
  updateBookingContact,
  uploadManualReceipt,
  type CreateBookingResult,
} from "@/lib/booking/actions";
import { isContactComplete, isValidCustomerName, isValidCustomerPhone } from "@/lib/booking/state-machine";
import { SubmitButton } from "@/app/components/SubmitButton";
import { BoldButton } from "@/app/components/BoldButton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function IconInput({
  icon,
  invalid,
  ...props
}: { icon: string; invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
      <input
        {...props}
        className={`w-full rounded-md border py-3 pl-10 pr-3 text-base focus:outline-none focus:ring-1 ${
          invalid
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
        }`}
      />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mt-6 grid animate-pulse gap-3 lg:mt-0">
      <div className="h-4 w-20 rounded bg-gray-200" />
      <div className="h-12 rounded-md bg-gray-100" />
      <div className="h-12 rounded-md bg-gray-100" />
      <div className="h-32 rounded-xl bg-gray-100" />
      <div className="h-12 rounded-full bg-gray-200" />
    </div>
  );
}

export function ReservarForm({
  orgSlug,
  venueId,
  date,
  start,
  end,
  cancellationWindowHours,
}: {
  orgSlug: string;
  venueId: string;
  date: string;
  start: string;
  end: string;
  cancellationWindowHours: number;
}) {
  const router = useRouter();
  const [shell, setShell] = useState<CreateBookingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `reserva-shell:${venueId}:${date}:${start}`;

  // Congela el horario apenas se abre la página (antes de que el cliente escriba nada) para que el
  // botón de pago ya esté listo de inmediato — sin un paso de "Continuar" en medio. Si la página se
  // recarga, reutiliza la misma reserva (sessionStorage) en vez de intentar crear otra para el mismo
  // horario.
  //
  // React (Strict Mode, solo en dev) invoca este efecto dos veces al montar. Sin la guarda de
  // initRef, ambas invocaciones alcanzaban a llamar createBookingShell casi al mismo tiempo (antes de
  // que la primera guardara nada en sessionStorage): una creaba la reserva real, la otra chocaba
  // contra su propio hermano con "cupo_no_disponible" — y si la que "ganaba" era justo la que React
  // descartaba por cleanup, el cliente se quedaba viendo el error para siempre aunque sí existiera
  // una reserva (huérfana, sin nombre) en la base de datos.
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    async function init() {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached) as CreateBookingResult;
          setShell(parsedCache);
          setLoading(false);
          return;
        } catch {
          sessionStorage.removeItem(storageKey);
        }
      }

      const result = await createBookingShell({ orgSlug, venueId, date, startTime: start, endTime: end });
      if (result.ok) {
        sessionStorage.setItem(storageKey, JSON.stringify(result));
      }
      setShell(result);
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguarda nombre/teléfono a medida que el cliente escribe (sin botón "Guardar").
  useEffect(() => {
    if (!shell?.ok || (!customerName && !customerPhone)) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateBookingContact({ bookingId: shell.bookingId, customerName, customerPhone, customerEmail });
    }, 600);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [customerName, customerPhone, customerEmail, shell]);

  // Si Bold confirma mientras el cliente sigue en esta misma página, lo llevamos a la página
  // definitiva de la reserva (la misma a la que Bold redirige tras el pago).
  const { data: statusData } = useSWR<{ status: string }>(
    shell?.ok ? `/api/${orgSlug}/reserva/${shell.bookingId}/status` : null,
    fetcher,
    { refreshInterval: 4000 },
  );

  useEffect(() => {
    if (shell?.ok && statusData?.status && statusData.status !== "PENDIENTE_PAGO") {
      sessionStorage.removeItem(storageKey);
      router.push(`/${orgSlug}/reserva/${shell.bookingId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusData]);

  useEffect(() => {
    if (shell && !shell.ok) {
      toast.error(
        shell.error === "cupo_no_disponible"
          ? "Justo alguien más reservó esa hora."
          : "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
      );
    }
  }, [shell]);

  if (loading) {
    return <FormSkeleton />;
  }

  if (!shell?.ok) {
    return (
      <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800 lg:mt-0">
        {shell?.error === "cupo_no_disponible" ? (
          <>
            Justo alguien más reservó esa hora.{" "}
            <Link href={`/${orgSlug}/${venueId}`} className="underline">
              Elegir otro horario
            </Link>
          </>
        ) : (
          "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo."
        )}
      </p>
    );
  }

  const remainder = shell.totalAmount - shell.depositAmount;
  const nameValid = isValidCustomerName(customerName);
  const phoneValid = isValidCustomerPhone(customerPhone);
  const contactComplete = isContactComplete(customerName, customerPhone);

  return (
    <div className="mt-6 lg:mt-0">
      <h2 className="text-sm font-medium text-gray-700">Tus datos</h2>
      <div className="mt-3 grid gap-3">
        <div>
          <IconInput
            icon="👤"
            aria-label="Nombre completo"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            invalid={nameTouched && customerName.length > 0 && !nameValid}
            aria-invalid={nameTouched && customerName.length > 0 && !nameValid}
            aria-describedby={nameTouched && customerName.length > 0 && !nameValid ? "name-error" : undefined}
            placeholder="Nombre completo"
          />
          {nameTouched && customerName.length > 0 && !nameValid && (
            <p id="name-error" className="mt-1 text-xs text-red-600">
              Escribe al menos 3 letras, sin números ni símbolos.
            </p>
          )}
        </div>
        <div>
          <IconInput
            icon="💬"
            aria-label="WhatsApp, 10 dígitos"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            onBlur={() => setPhoneTouched(true)}
            invalid={phoneTouched && customerPhone.length > 0 && !phoneValid}
            aria-invalid={phoneTouched && customerPhone.length > 0 && !phoneValid}
            aria-describedby={phoneTouched && customerPhone.length > 0 && !phoneValid ? "phone-error" : undefined}
            type="tel"
            inputMode="numeric"
            placeholder="WhatsApp (10 dígitos)"
          />
          {phoneTouched && customerPhone.length > 0 && !phoneValid && (
            <p id="phone-error" className="mt-1 text-xs text-red-600">
              El número debe tener 10 dígitos ({customerPhone.length}/10).
            </p>
          )}
        </div>
        <IconInput
          icon="✉️"
          aria-label="Email (opcional)"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          type="email"
          placeholder="Email (opcional)"
        />
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700">Resumen de pago</h2>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-gray-500">Total reserva (1 hora)</span>
          <span className="text-gray-900">${shell.totalAmount.toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-1.5 flex justify-between text-sm">
          <span className="text-gray-500">Abono (para confirmar)</span>
          <span className="text-gray-900">- ${shell.depositAmount.toLocaleString("es-CO")}</span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-gray-100 pt-1.5 text-sm font-medium">
          <span className="text-gray-700">Saldo restante</span>
          <span className="text-lg font-semibold text-emerald-700">${remainder.toLocaleString("es-CO")}</span>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-md bg-emerald-50 p-2.5 text-xs text-emerald-800">
          <span>ℹ️</span>
          <span>Paga solo el abono para confirmar tu reserva. El saldo restante lo pagas en la cancha.</span>
        </p>
        {cancellationWindowHours > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-md bg-gray-50 p-2.5 text-xs text-gray-600">
            <span>🛡️</span>
            <span>
              Cancela gratis hasta {cancellationWindowHours} horas antes de tu reserva, escribiéndonos por
              WhatsApp.
            </span>
          </p>
        )}
      </div>

      <div className="mt-4">
        {shell.boldPayload ? (
          <>
            <BoldButton
              payload={shell.boldPayload}
              label="🔒 Pagar abono y confirmar reserva"
              disabled={!contactComplete}
              onDisabledClick={() => {
                setShowHint(true);
                setNameTouched(true);
                setPhoneTouched(true);
              }}
            />
            {showHint && !contactComplete && (
              <p className="mt-2 text-center text-xs text-amber-700">
                Completa tu nombre y WhatsApp arriba para poder pagar.
              </p>
            )}
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-500">
              🔒 Pago 100% seguro con Bold · No te cobraremos el saldo restante ahora
            </p>
          </>
        ) : (
          <form action={uploadManualReceipt} className="grid gap-3 rounded-xl border border-gray-200 p-4">
            <input type="hidden" name="bookingId" value={shell.bookingId} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <p className="text-sm text-gray-600">
              Paga por Nequi/Daviplata y sube aquí el comprobante para que recepción lo verifique.
            </p>
            <input
              type="file"
              name="receipt"
              accept="image/*,application/pdf"
              required
              disabled={!contactComplete}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200 disabled:opacity-50"
            />
            {!contactComplete && (
              <p className="text-xs text-amber-700">Completa tu nombre y WhatsApp arriba primero.</p>
            )}
            <SubmitButton
              pendingLabel="Subiendo…"
              disabled={!contactComplete}
              className="rounded-md bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-800 disabled:bg-gray-300"
            >
              Subir comprobante
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
        <div>
          <div className="text-lg">🛡️</div>
          Confirmación
          <br />
          inmediata
        </div>
        <div>
          <div className="text-lg">🔒</div>
          Sin cargos
          <br />
          ocultos
        </div>
        <div>
          <div className="text-lg">💬</div>
          Soporte por
          <br />
          WhatsApp
        </div>
      </div>
    </div>
  );
}
