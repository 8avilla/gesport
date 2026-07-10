import Image from "next/image";

// Footer real y mínimo: sin "Redes" ni enlaces de contacto inventados — hoy no hay un número de
// WhatsApp de soporte de la plataforma configurado en ningún lado (cada complejo tiene el suyo,
// mostrado dentro de su propio flujo), así que este footer no fabrica uno.
export function Footer() {
  return (
    <footer className="mt-10 border-t border-gray-100 px-4 py-8 text-center lg:px-10 xl:px-16">
      <Image
        src="/logo.png"
        alt="Cancha Libre"
        width={1774}
        height={887}
        className="mx-auto h-6 w-auto opacity-80"
      />
      <p className="mt-3 text-xs text-gray-500">© {new Date().getFullYear()} Cancha Libre</p>
    </footer>
  );
}
