import Image from "next/image";
import { Footer } from "@/app/components/Footer";

export default function TerminosPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} className="h-9 w-auto" priority />
        <h1 className="mt-6 text-2xl font-semibold text-gray-900">Términos y privacidad</h1>
        <p className="mt-1 text-sm text-gray-500">Última actualización: julio de 2026.</p>

        <h2 className="mt-8 text-lg font-semibold text-gray-900" id="terminos">
          Términos de uso
        </h2>
        <div className="mt-3 grid gap-3 text-sm leading-relaxed text-gray-700">
          <p>
            Cancha Libre es un intermediario de reservas: pone en contacto a jugadores con complejos
            deportivos independientes. Cada complejo (fútbol, pádel) es operado por su propio dueño,
            responsable de la cancha, sus horarios y el servicio prestado en el lugar.
          </p>
          <p>
            Al reservar, el abono se cobra en línea a través de Bold para confirmar el cupo. El saldo
            restante y cualquier consumo adicional se paga directamente en el complejo.
          </p>
          <p>
            La ventana de cancelación con reembolso la define cada complejo (se muestra al reservar).
            Fuera de esa ventana, el abono no es reembolsable.
          </p>
          <p>
            El acceso a &quot;Mis reservas&quot; es por número de WhatsApp y un código de un solo uso — no hay
            contraseña. Eres responsable de mantener el acceso a tu WhatsApp seguro.
          </p>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-gray-900" id="privacidad">
          Política de privacidad
        </h2>
        <div className="mt-3 grid gap-3 text-sm leading-relaxed text-gray-700">
          <p>Al reservar o registrar tu complejo, recogemos:</p>
          <ul className="list-disc pl-5">
            <li>Nombre completo</li>
            <li>Número de WhatsApp</li>
            <li>Email (opcional)</li>
          </ul>
          <p>
            Usamos estos datos únicamente para confirmar tu reserva, identificarte en &quot;Mis reservas&quot;
            y que el complejo pueda contactarte sobre tu turno. No vendemos ni compartimos tus datos
            con terceros ajenos a la operación de tu reserva.
          </p>
          <p>
            Tratamos tus datos personales conforme a la Ley 1581 de 2012 (Habeas Data) de Colombia.
            Puedes solicitar la actualización o eliminación de tus datos escribiendo al complejo donde
            reservaste.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
