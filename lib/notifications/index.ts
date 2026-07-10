import FormData from "form-data";
import Mailgun from "mailgun.js";

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL;
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL;
const MAILGUN_FROM_NAME = process.env.MAILGUN_FROM_NAME;

// Bandeja del equipo de Cancha Libre para leads de "Registrar cancha" — elegida explícitamente por
// el dueño de la plataforma mientras no exista una casilla dedicada.
const VENUE_LEAD_EMAIL = "8avilla@gmail.com";

const mailgunClient =
  MAILGUN_API_KEY && MAILGUN_DOMAIN
    ? new Mailgun(FormData).client({ username: "api", key: MAILGUN_API_KEY, url: MAILGUN_BASE_URL })
    : null;

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!mailgunClient || !MAILGUN_DOMAIN) {
    console.warn(`[notifications] Mailgun no configurado, se omite el envío a ${to}: ${subject}`);
    return;
  }

  await mailgunClient.messages.create(MAILGUN_DOMAIN, {
    from: `${MAILGUN_FROM_NAME ?? "Cancha Libre"} <${MAILGUN_FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
  });
}

// TODO: cuando existan credenciales de WhatsApp Business API, esta es la única función que hay que
// tocar — negocio.md exige confirmar por WhatsApp y el flujo de reserva solo captura teléfono, no email.
export const NotificationService = {
  async sendBookingConfirmation(params: {
    customerPhone: string;
    customerName: string;
    venueName: string;
    date: string;
    startTime: string;
    endTime: string;
  }): Promise<void> {
    console.warn(
      `[notifications] WhatsApp no configurado todavía — se omite la confirmación a ${params.customerPhone} ` +
        `(${params.venueName}, ${params.date} ${params.startTime}-${params.endTime})`,
    );
  },

  // Mismo hueco que sendBookingConfirmation: hasta que existan credenciales de WhatsApp Business
  // API, el código de acceso de "Mis reservas" solo queda registrado acá (requestLoginCode además
  // devuelve el código en dev/staging para poder probar el login sin WhatsApp real).
  async sendLoginCode(params: { customerPhone: string; code: string }): Promise<void> {
    console.warn(
      `[notifications] WhatsApp no configurado todavía — código de acceso para ${params.customerPhone}: ` +
        `${params.code} (válido 5 minutos)`,
    );
  },

  async sendVenueRegistrationLead(params: {
    contactName: string;
    venueName: string;
    city: string;
    phone: string;
    email?: string;
  }): Promise<void> {
    await sendEmail(
      VENUE_LEAD_EMAIL,
      `Nuevo lead: registrar cancha — ${params.venueName}`,
      `<p>Alguien quiere sumar su complejo a Cancha Libre.</p>
       <ul>
         <li>Contacto: ${params.contactName}</li>
         <li>Complejo: ${params.venueName}</li>
         <li>Ciudad: ${params.city}</li>
         <li>WhatsApp: ${params.phone}</li>
         ${params.email ? `<li>Email: ${params.email}</li>` : ""}
       </ul>`,
    );
  },

  async sendCashMismatchAlert(params: {
    adminEmail: string;
    shiftId: string;
    expectedTotal: number;
    countedTotal: number;
    discrepancy: number;
  }): Promise<void> {
    await sendEmail(
      params.adminEmail,
      `Descuadre de caja detectado — turno ${params.shiftId}`,
      `<p>Se detectó un descuadre en el cierre de caja del turno <strong>${params.shiftId}</strong>.</p>
       <ul>
         <li>Total esperado: ${params.expectedTotal}</li>
         <li>Efectivo contado: ${params.countedTotal}</li>
         <li>Diferencia: ${params.discrepancy}</li>
       </ul>`,
    );
  },

  // negocio.md §5: "Alertas automáticas de inventario bajo... evitando desabastecimiento."
  async sendLowStockAlert(params: {
    adminEmail: string;
    productName: string;
    stock: number;
    threshold: number;
  }): Promise<void> {
    await sendEmail(
      params.adminEmail,
      `Stock bajo: ${params.productName}`,
      `<p>El producto <strong>${params.productName}</strong> quedó con ${params.stock} unidades,
       por debajo del umbral configurado (${params.threshold}). Considera reabastecerlo.</p>`,
    );
  },
};
