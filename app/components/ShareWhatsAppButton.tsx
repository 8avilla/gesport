"use client";

// Botón "compartir por WhatsApp": arma el link wa.me con el resumen ya redactado para que el
// cliente no tenga que copiar/pegar a mano — wa.me sin número abre el selector de contactos de
// WhatsApp para que elija a quién enviárselo (ej. con quién va a jugar).
export function ShareWhatsAppButton({ message }: { message: string }) {
  const href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-medium text-white hover:bg-[#1fb959]"
    >
      <span aria-hidden="true">💬</span>
      Compartir por WhatsApp
    </a>
  );
}
