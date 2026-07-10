"use client";

import { useState } from "react";
import Script from "next/script";
import type { BoldCheckoutPayload } from "@/lib/payments/bold";

// Integración de botón personalizado (no el widget con el diseño de Bold), verificado contra
// https://developers.bold.co/pagos-en-linea/boton-de-pagos/integracion-personalizada :
// la librería expone un constructor global `BoldCheckout` — se crea una instancia con los datos del
// checkout y se llama a `.open()` cuando el cliente hace click en NUESTRO botón. Como nosotros
// disparamos el checkout explícitamente (en vez de que Bold escanee el DOM buscando un marcador al
// cargar el script), no hay condición de carrera entre montajes ni problema con que next/script
// deduplique el <script> por `src` entre una reserva y la siguiente en la misma sesión — el
// constructor `window.BoldCheckout` sigue disponible igual.
declare global {
  interface Window {
    BoldCheckout?: new (config: {
      orderId: string;
      currency: string;
      amount: string;
      apiKey: string;
      redirectionUrl: string;
      integritySignature: string;
      description: string;
    }) => { open: () => void };
  }
}

export function BoldButton({
  payload,
  label = "Pagar y reservar",
  disabled = false,
  onDisabledClick,
}: {
  payload: BoldCheckoutPayload;
  label?: string;
  disabled?: boolean;
  onDisabledClick?: () => void;
}) {
  const [libraryReady, setLibraryReady] = useState(false);

  function handleClick() {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    if (!window.BoldCheckout) {
      return;
    }
    const checkout = new window.BoldCheckout({
      orderId: payload.orderId,
      currency: payload.currency,
      amount: String(payload.amount),
      apiKey: payload.apiKey,
      redirectionUrl: payload.redirectionUrl,
      integritySignature: payload.integritySignature,
      description: payload.description,
    });
    checkout.open();
  }

  return (
    <>
      {/* onReady (a diferencia de onLoad) se dispara en cada montaje, incluso si el script ya
          estaba cargado de una reserva anterior en la misma sesión — así este botón siempre sabe
          cuándo `window.BoldCheckout` está listo para usarse. */}
      <Script
        src="https://checkout.bold.co/library/boldPaymentButton.js"
        strategy="afterInteractive"
        onReady={() => setLibraryReady(true)}
      />
      <button
        type="button"
        onClick={handleClick}
        aria-disabled={disabled}
        className={`w-full rounded-full px-6 py-3.5 text-center text-base font-semibold text-white shadow-sm transition-colors ${
          disabled || !libraryReady
            ? "cursor-not-allowed bg-gray-300"
            : "bg-emerald-700 hover:bg-emerald-800"
        }`}
      >
        {label}
      </button>
    </>
  );
}
