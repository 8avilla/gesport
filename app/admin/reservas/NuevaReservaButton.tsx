"use client";

import { useOpenReservaDrawer } from "./ReservaDrawerProvider";

export function NuevaReservaButton({ className }: { className: string }) {
  const openDrawer = useOpenReservaDrawer();

  return (
    <button type="button" onClick={() => openDrawer()} className={className}>
      + Nueva reserva
    </button>
  );
}
