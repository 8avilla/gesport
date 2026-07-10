import Image from "next/image";
import { submitVenueLead } from "@/lib/leads/actions";

const ERROR_MESSAGES: Record<string, string> = {
  datos_invalidos: "Revisa los datos del formulario.",
  demasiados_intentos: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
};

const BENEFITS = [
  { icon: "📅", title: "Reservas automáticas", text: "Tus clientes reservan y pagan el abono solos, sin llamadas." },
  { icon: "🔒", title: "Caja blindada", text: "Cierres de turno auditados, sin descuadres ni fugas de dinero." },
  { icon: "🧾", title: "POS integrado", text: "Consumo de barra vinculado a cada reserva, todo en una cuenta." },
];

export default async function RegistrarCanchaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; error?: string }>;
}) {
  const { enviado, error } = await searchParams;

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} className="h-9 w-auto" priority />
      <h1 className="mt-6 text-2xl font-semibold text-gray-900">Lleva tu complejo a Cancha Libre</h1>
      <p className="mt-1 text-sm text-gray-500">Cuéntanos de tu cancha y te contactamos para sumarte.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-2xl">{benefit.icon}</div>
            <p className="mt-1 text-sm font-medium text-gray-900">{benefit.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{benefit.text}</p>
          </div>
        ))}
      </div>

      {enviado === "1" ? (
        <p className="mt-6 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          ¡Listo! Recibimos tus datos y te contactaremos pronto.
        </p>
      ) : (
        <form action={submitVenueLead} className="mt-6 grid gap-4">
          {error && ERROR_MESSAGES[error] && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{ERROR_MESSAGES[error]}</p>
          )}

          <label className="grid gap-1 text-sm">
            Tu nombre
            <input name="contactName" required className="rounded-md border border-gray-300 px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            Nombre del complejo
            <input name="venueName" required className="rounded-md border border-gray-300 px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            Ciudad
            <input name="city" required className="rounded-md border border-gray-300 px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            WhatsApp
            <input name="phone" type="tel" required className="rounded-md border border-gray-300 px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            Email (opcional)
            <input name="email" type="email" className="rounded-md border border-gray-300 px-3 py-2" />
          </label>

          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
          >
            Enviar
          </button>
        </form>
      )}
    </main>
  );
}
