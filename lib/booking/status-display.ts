// Único punto de verdad para cómo se ve un BookingStatus en toda la UI (admin). Antes vivía
// duplicado casi-idéntico en app/admin/reservas/page.tsx (badge Tailwind) y en
// app/admin/DashboardCharts.tsx (hex para el donut) — unificado acá para que la leyenda de la
// agenda, la tabla de reservas y el dashboard siempre coincidan.
export const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Cobrada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
  EXPIRADA: "Expirada",
  SOLICITADA: "Solicitud sin pago",
};

// Hex, para contextos sin Tailwind (recharts, estilos inline en el grid de agenda).
export const STATUS_COLOR: Record<string, string> = {
  PENDIENTE_PAGO: "#f59e0b",
  CONFIRMADA: "#059669",
  EN_CURSO: "#3b82f6",
  FINALIZADA: "#6b7280",
  CANCELADA: "#ef4444",
  NO_SHOW: "#b91c1c",
  EXPIRADA: "#9ca3af",
  SOLICITADA: "#6366f1",
};

// Clases Tailwind, para badges/pills.
export const STATUS_BADGE_STYLE: Record<string, string> = {
  PENDIENTE_PAGO: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  CONFIRMADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  EN_CURSO: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  FINALIZADA: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  CANCELADA: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  NO_SHOW: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  EXPIRADA: "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200",
  SOLICITADA: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
};

// Bloque de la agenda: color de fondo + texto suave (no el badge saturado) para que el nombre del
// cliente siga siendo legible dentro del bloque.
export const STATUS_BLOCK_STYLE: Record<string, string> = {
  PENDIENTE_PAGO: "border-amber-300 bg-amber-100 text-amber-900",
  CONFIRMADA: "border-emerald-300 bg-emerald-100 text-emerald-900",
  EN_CURSO: "border-blue-300 bg-blue-100 text-blue-900",
  FINALIZADA: "border-gray-300 bg-gray-100 text-gray-700",
  CANCELADA: "border-red-300 bg-red-100 text-red-800",
  NO_SHOW: "border-red-300 bg-red-100 text-red-800",
  EXPIRADA: "border-gray-200 bg-gray-50 text-gray-500",
  SOLICITADA: "border-indigo-300 bg-indigo-100 text-indigo-900",
};

export const STATUS_ICON: Record<string, string> = {
  PENDIENTE_PAGO: "🕒",
  CONFIRMADA: "✓",
  EN_CURSO: "▶",
  FINALIZADA: "✓",
  CANCELADA: "✕",
  NO_SHOW: "✕",
  EXPIRADA: "✕",
  SOLICITADA: "📨",
};

// Los únicos 4 estados que la leyenda de la agenda muestra (mockup) — el resto (EN_CURSO, NO_SHOW,
// EXPIRADA) sigue coloreado en el grid pero no aparece en la leyenda por ser poco frecuentes.
export const LEGEND_STATUSES = ["CONFIRMADA", "PENDIENTE_PAGO", "CANCELADA", "FINALIZADA"] as const;

// Estado de pago de una reserva — eje distinto del BookingStatus de arriba. Se deriva de
// depositAmount/totalAmount para las reservas "activas" (CONFIRMADA/EN_CURSO), trata FINALIZADA
// como siempre pagada (ya se cobró total+consumo al cerrar la cuenta, mismo criterio que
// computeAmountPaid en lib/admin/queries.ts) y PENDIENTE_PAGO como su propia categoría ("esperando
// pago por plataforma", ej. Bold) — nunca se confunde con "sin pagos". CANCELADA/NO_SHOW/EXPIRADA
// no entran en este modelo (devuelve null): esas se siguen mostrando con su STATUS_LABEL/
// STATUS_BLOCK_STYLE de siempre, no se les inventa un estado de pago que no tienen.
export type PaymentState = "PAGADA" | "ABONADA" | "SIN_PAGOS" | "ESPERANDO_PAGO_PLATAFORMA";

export function getPaymentState(booking: {
  status: string;
  totalAmount: number;
  depositAmount: number;
}): PaymentState | null {
  if (booking.status === "PENDIENTE_PAGO") {
    return "ESPERANDO_PAGO_PLATAFORMA";
  }
  if (booking.status === "FINALIZADA") {
    return "PAGADA";
  }
  if (booking.status === "CONFIRMADA" || booking.status === "EN_CURSO") {
    if (booking.depositAmount <= 0) return "SIN_PAGOS";
    if (booking.depositAmount >= booking.totalAmount) return "PAGADA";
    return "ABONADA";
  }
  return null;
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  PAGADA: "Pagada",
  ABONADA: "Abonada",
  SIN_PAGOS: "Sin pagos",
  ESPERANDO_PAGO_PLATAFORMA: "Esperando pago por plataforma",
};

// Hex, mismo uso que STATUS_COLOR (recharts, dots de leyenda).
export const PAYMENT_STATE_COLOR: Record<PaymentState, string> = {
  PAGADA: "#059669",
  ABONADA: "#f59e0b",
  SIN_PAGOS: "#6b7280",
  ESPERANDO_PAGO_PLATAFORMA: "#3b82f6",
};

export const PAYMENT_STATE_BADGE_STYLE: Record<PaymentState, string> = {
  PAGADA: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  ABONADA: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  SIN_PAGOS: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  ESPERANDO_PAGO_PLATAFORMA: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
};

// Bloque de la agenda: mismo criterio que STATUS_BLOCK_STYLE (color de fondo + texto suave).
export const PAYMENT_STATE_BLOCK_STYLE: Record<PaymentState, string> = {
  PAGADA: "border-emerald-300 bg-emerald-100 text-emerald-900",
  ABONADA: "border-amber-300 bg-amber-100 text-amber-900",
  SIN_PAGOS: "border-gray-300 bg-gray-100 text-gray-700",
  ESPERANDO_PAGO_PLATAFORMA: "border-blue-300 bg-blue-100 text-blue-900",
};

export const PAYMENT_STATE_ICON: Record<PaymentState, string> = {
  PAGADA: "✓",
  ABONADA: "◐",
  SIN_PAGOS: "○",
  ESPERANDO_PAGO_PLATAFORMA: "🕒",
};

// Leyenda de la vista agenda — Pagada/Abonada/Sin pagos/Esperando pago, en ese orden.
export const LEGEND_PAYMENT_STATES: PaymentState[] = ["PAGADA", "ABONADA", "SIN_PAGOS", "ESPERANDO_PAGO_PLATAFORMA"];
