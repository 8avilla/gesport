"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

// Dispara un toast flotante para un mensaje que hoy llega por query param (?error=..., ?comprobante=...)
// y limpia el param de la URL — así no se re-muestra el mismo toast si el usuario recarga la página.
export function QueryToast({ type, message }: { type: "error" | "success"; message: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (type === "error") {
      toast.error(message);
    } else {
      toast.success(message);
    }
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe disparar una vez al montar
  }, []);

  return null;
}
