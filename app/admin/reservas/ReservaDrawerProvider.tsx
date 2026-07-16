"use client";

import { createContext, useContext, useState } from "react";
import { NuevaReservaDrawer, type VenueForBooking } from "./NuevaReservaDrawer";
import { VerReservaDrawer, type ViewBookingInfo } from "./VerReservaDrawer";

type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; venueId?: string; startTime?: string }
  | { mode: "view"; booking: ViewBookingInfo };

type ReservaDrawerContextValue = {
  openCreate: (venueId?: string, startTime?: string) => void;
  openView: (booking: ViewBookingInfo) => void;
};

const ReservaDrawerContext = createContext<ReservaDrawerContextValue | null>(null);

// Abre los drawers de "Nueva reserva"/"Ver reserva" al instante, sin ir al servidor — antes, tanto
// el botón "+ Nueva reserva" como cada celda "+ Libre" de la agenda eran <Link> a
// /admin/reservas?nueva=1&…, que navegaba la página entera (re-consulta agenda, próximas reservas,
// todo) solo para mostrar un formulario. En una conexión lenta eso deja un par de segundos donde
// solo se ve el fondo oscuro del overlay sin el panel encima — que es exactamente el bug reportado
// ("todo oscuro" al tocar +Libre).
export function useOpenReservaDrawer(): (venueId?: string, startTime?: string) => void {
  const ctx = useContext(ReservaDrawerContext);
  if (!ctx) {
    throw new Error("useOpenReservaDrawer debe usarse dentro de ReservaDrawerProvider");
  }
  return ctx.openCreate;
}

// Para las celdas ya reservadas de la agenda (AgendaGrid.tsx) — la reserva ya viene completa desde
// getAgendaBookings, no hace falta pedirla de nuevo al servidor para mostrar el detalle.
export function useViewReserva(): (booking: ViewBookingInfo) => void {
  const ctx = useContext(ReservaDrawerContext);
  if (!ctx) {
    throw new Error("useViewReserva debe usarse dentro de ReservaDrawerProvider");
  }
  return ctx.openView;
}

export function ReservaDrawerProvider({
  children,
  venues,
  defaultDate,
  defaultOpen,
  defaultVenueId,
  defaultStartTime,
  error,
}: {
  children: React.ReactNode;
  venues: VenueForBooking[];
  defaultDate: string;
  defaultOpen: boolean;
  defaultVenueId?: string;
  defaultStartTime?: string;
  error?: string;
}) {
  const [drawer, setDrawer] = useState<DrawerState>(
    defaultOpen ? { mode: "create", venueId: defaultVenueId, startTime: defaultStartTime } : { mode: "closed" },
  );

  const contextValue: ReservaDrawerContextValue = {
    openCreate: (venueId, startTime) => setDrawer({ mode: "create", venueId, startTime }),
    openView: (booking) => setDrawer({ mode: "view", booking }),
  };

  return (
    <ReservaDrawerContext.Provider value={contextValue}>
      {children}

      {drawer.mode === "create" && (
        <NuevaReservaDrawer
          venues={venues}
          defaultDate={defaultDate}
          defaultVenueId={drawer.venueId}
          defaultStartTime={drawer.startTime}
          onClose={() => setDrawer({ mode: "closed" })}
          error={error}
        />
      )}

      {drawer.mode === "view" && <VerReservaDrawer booking={drawer.booking} onClose={() => setDrawer({ mode: "closed" })} />}
    </ReservaDrawerContext.Provider>
  );
}
