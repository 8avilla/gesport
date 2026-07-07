"use client";

import { useRef, useState } from "react";

const SWIPE_THRESHOLD = 88;

// Envuelve una fila del POS para permitir deslizar en vez de apuntarle a un botón chico: deslizar a la
// derecha dispara la acción "positiva" (aprobar), a la izquierda la "negativa" (rechazar). Los botones
// originales se mantienen debajo como respaldo (mouse/teclado/lector de pantalla no deslizan).
export function SwipeableRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel,
  leftLabel,
}: {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true);
    startXRef.current = e.clientX;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) {
      return;
    }
    setDragX(e.clientX - startXRef.current);
  }

  function handlePointerUp() {
    if (!dragging) {
      return;
    }
    setDragging(false);
    if (dragX > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (dragX < -SWIPE_THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    }
    setDragX(0);
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-0 flex items-center justify-between px-4">
        {rightLabel && (
          <span
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity"
            style={{ opacity: Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1) }}
          >
            {rightLabel}
          </span>
        )}
        {leftLabel && (
          <span
            className="ml-auto rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity"
            style={{ opacity: Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1) }}
          >
            {leftLabel}
          </span>
        )}
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease-out",
          touchAction: "pan-y",
        }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  );
}
