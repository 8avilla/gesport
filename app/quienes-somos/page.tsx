import Image from "next/image";
import { Footer } from "@/app/components/Footer";

export default function QuienesSomosPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} className="h-9 w-auto" priority />
        <h1 className="mt-6 text-2xl font-semibold text-gray-900">Quienes somos</h1>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Cancha Libre es una plataforma de reservas para complejos deportivos. Conectamos a
          jugadores con canchas de fútbol y pádel disponibles ahora mismo, y le damos a cada
          complejo las herramientas para operar sin depender del teléfono ni de cuadernos de papel.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Para el jugador: buscar cancha, ver horarios reales y pagar el abono en minutos, sin
          llamadas ni esperas.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Para el dueño del complejo: agenda digital contra sobrecupos, punto de venta para la
          barra, y cierres de caja auditados turno a turno — todo en un solo lugar.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">
          Nada de lo que mostramos es inventado: sin calificaciones falsas, sin contadores de
          demanda artificiales, sin promociones que no existen.
        </p>
      </main>
      <Footer />
    </>
  );
}
