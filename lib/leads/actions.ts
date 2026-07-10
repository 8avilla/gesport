"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { NotificationService } from "@/lib/notifications";

const venueLeadSchema = z.object({
  contactName: z.string().trim().min(3).max(200),
  venueName: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(7).max(50),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

// Lead de un dueño de complejo que quiere sumarse — se envía por email al equipo de Cancha Libre
// (VENUE_LEAD_EMAIL en lib/notifications/index.ts). No se persiste en base de datos: decisión
// explícita de revisar los leads manualmente por correo mientras no exista un CRM/panel para esto.
export async function submitVenueLead(formData: FormData): Promise<void> {
  const parsed = venueLeadSchema.safeParse({
    contactName: formData.get("contactName"),
    venueName: formData.get("venueName"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect("/registrar-cancha?error=datos_invalidos");
  }

  const ip = await getClientIp();
  if (!checkRateLimit(`lead-cancha:${ip}`, 5, 60 * 60_000)) {
    redirect("/registrar-cancha?error=demasiados_intentos");
  }

  const { contactName, venueName, city, phone, email } = parsed.data;
  await NotificationService.sendVenueRegistrationLead({
    contactName,
    venueName,
    city,
    phone,
    email: email || undefined,
  });

  redirect("/registrar-cancha?enviado=1");
}
