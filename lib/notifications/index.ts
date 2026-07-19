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

  // Correo real (Mailgun) con los datos de la reserva confirmada — ver confirmBookingPayment en
  // lib/booking/actions.ts. Solo se envía si el cliente dejó email (es opcional en el formulario).
  async sendBookingConfirmationEmail(params: {
    customerEmail: string;
    customerName: string;
    venueName: string;
    orgName: string;
    dateLabel: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    depositAmount: number;
  }): Promise<void> {
    await sendEmail(
      params.customerEmail,
      `Reserva confirmada — ${params.venueName}`,
      `<p>Hola ${params.customerName}, tu reserva quedó confirmada.</p>
       <ul>
         <li>Complejo: ${params.orgName}</li>
         <li>Cancha: ${params.venueName}</li>
         <li>Fecha: ${params.dateLabel}</li>
         <li>Horario: ${params.startTime} - ${params.endTime}</li>
         <li>Total: $${params.totalAmount.toLocaleString("es-CO")}</li>
         <li>Abono pagado: $${params.depositAmount.toLocaleString("es-CO")}</li>
       </ul>
       <p>Nos vemos en la cancha.</p>`,
    );
  },

  // Aviso interno al admin de una SOLICITUD sin pago (cancha con Venue.requiresPayment=false) — a
  // diferencia de sendNewBookingAlertEmail, esto no es una reserva confirmada: el admin tiene que
  // decidir. Incluye un link wa.me al teléfono del cliente para que el admin conteste con un toque
  // (no hay envío de WhatsApp automático real todavía — ver el TODO de arriba).
  async sendNewBookingRequestAlertEmail(params: {
    adminEmail: string;
    customerName: string;
    customerPhone: string;
    venueName: string;
    dateLabel: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    confirmUrl: string;
  }): Promise<void> {
    const waMessage = `Hola ${params.customerName}, recibimos tu solicitud de reserva en ${params.venueName} el ${params.dateLabel} a las ${params.startTime}.`;
    const waLink = `https://wa.me/57${params.customerPhone}?text=${encodeURIComponent(waMessage)}`;

    await sendEmail(
      params.adminEmail,
      `Nueva solicitud sin pago — requiere confirmación — ${params.venueName}`,
      `<p>Entró una solicitud de reserva <strong>sin abono ni pago</strong>. No se aparta el cupo
       hasta que la confirmes.</p>
       <ul>
         <li>Cliente: ${params.customerName} (${params.customerPhone})</li>
         <li>Cancha: ${params.venueName}</li>
         <li>Fecha: ${params.dateLabel}</li>
         <li>Horario: ${params.startTime} - ${params.endTime}</li>
         <li>Tarifa: $${params.totalAmount.toLocaleString("es-CO")}</li>
       </ul>
       <p><a href="${waLink}">Escribirle por WhatsApp</a></p>
       <p><a href="${params.confirmUrl}">Confirmar o rechazar desde el panel</a></p>`,
    );
  },

  // Aviso interno al admin del complejo — negocio.md: "notificando en paralelo a la recepción".
  async sendNewBookingAlertEmail(params: {
    adminEmail: string;
    customerName: string;
    customerPhone: string;
    venueName: string;
    dateLabel: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    depositAmount: number;
  }): Promise<void> {
    await sendEmail(
      params.adminEmail,
      `Nueva reserva confirmada — ${params.venueName}`,
      `<p>Entró una reserva nueva.</p>
       <ul>
         <li>Cliente: ${params.customerName} (${params.customerPhone})</li>
         <li>Cancha: ${params.venueName}</li>
         <li>Fecha: ${params.dateLabel}</li>
         <li>Horario: ${params.startTime} - ${params.endTime}</li>
         <li>Total: $${params.totalAmount.toLocaleString("es-CO")}</li>
         <li>Abono pagado: $${params.depositAmount.toLocaleString("es-CO")}</li>
       </ul>`,
    );
  },

  // Mismo hueco que sendBookingConfirmation: aviso de cancelación al cliente por WhatsApp — se llama
  // desde notifyBookingCancelled (lib/booking/actions.ts), sea que cancele el cliente, el admin, o el
  // cron de no-show.
  async sendBookingCancellation(params: {
    customerPhone: string;
    customerName: string;
    venueName: string;
    date: string;
    startTime: string;
    refundable: boolean;
  }): Promise<void> {
    console.warn(
      `[notifications] WhatsApp no configurado todavía — se omite el aviso de cancelación a ` +
        `${params.customerPhone} (${params.venueName}, ${params.date} ${params.startTime}, ` +
        `reembolsable: ${params.refundable})`,
    );
  },

  // Correo real (Mailgun) al admin del complejo avisando la cancelación — mismo espíritu que
  // sendNewBookingAlertEmail.
  async sendBookingCancelledAlertEmail(params: {
    adminEmail: string;
    customerName: string;
    customerPhone: string;
    venueName: string;
    dateLabel: string;
    startTime: string;
    endTime: string;
    refundable: boolean;
  }): Promise<void> {
    await sendEmail(
      params.adminEmail,
      `Reserva cancelada — ${params.venueName}`,
      `<p>Se canceló una reserva.</p>
       <ul>
         <li>Cliente: ${params.customerName} (${params.customerPhone})</li>
         <li>Cancha: ${params.venueName}</li>
         <li>Fecha: ${params.dateLabel}</li>
         <li>Horario: ${params.startTime} - ${params.endTime}</li>
         <li>Reembolsable: ${params.refundable ? "Sí" : "No"}</li>
       </ul>`,
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
