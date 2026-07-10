"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { isValidCustomerPhone } from "@/lib/booking/state-machine";
import { NotificationService } from "@/lib/notifications";
import { clearCustomerSessionCookie, setCustomerSessionCookie } from "./session";

const CODE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export type RequestLoginCodeResult = { ok: true; devCode?: string } | { ok: false; error: string };

// Pide un código de un solo uso por WhatsApp para iniciar sesión en "Mis reservas". Solo tiene
// sentido para un teléfono que ya reservó alguna vez (ver verifyLoginCode) — acá no se valida eso
// todavía para no filtrar por temporización si un número existe o no como cliente.
export async function requestLoginCode(phone: string): Promise<RequestLoginCodeResult> {
  if (!isValidCustomerPhone(phone)) {
    return { ok: false, error: "telefono_invalido" };
  }

  const ip = await getClientIp();
  if (!checkRateLimit(`otp-solicitud:${ip}`, 5, 10 * 60_000) || !checkRateLimit(`otp-solicitud:${phone}`, 5, 10 * 60_000)) {
    return { ok: false, error: "demasiados_intentos" };
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  // Un código nuevo invalida cualquiera anterior del mismo teléfono — nunca hay más de uno vigente.
  await db.customerLoginCode.deleteMany({ where: { phone } });
  await db.customerLoginCode.create({
    data: { phone, codeHash, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });

  await NotificationService.sendLoginCode({ customerPhone: phone, code });

  // WhatsApp Business API todavía no está configurado (ver lib/notifications/index.ts) — sin esto,
  // el login sería imposible de probar fuera de producción.
  const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
  return { ok: true, devCode };
}

export type VerifyLoginCodeResult = { ok: true } | { ok: false; error: string };

export async function verifyLoginCode(phone: string, code: string): Promise<VerifyLoginCodeResult> {
  if (!isValidCustomerPhone(phone) || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "codigo_invalido" };
  }

  const ip = await getClientIp();
  if (!checkRateLimit(`otp-verificar:${ip}`, 10, 10 * 60_000) || !checkRateLimit(`otp-verificar:${phone}`, 10, 10 * 60_000)) {
    return { ok: false, error: "demasiados_intentos" };
  }

  const loginCode = await db.customerLoginCode.findFirst({
    where: { phone, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!loginCode || loginCode.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "codigo_invalido" };
  }

  const matches = await bcrypt.compare(code, loginCode.codeHash);
  if (!matches) {
    await db.customerLoginCode.update({ where: { id: loginCode.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "codigo_invalido" };
  }

  const customer = await db.customer.findUnique({ where: { phone } });
  if (!customer) {
    // No se crea una cuenta fantasma: "Mis reservas" es para encontrar reservas existentes, no un
    // alta de cuenta nueva sin ninguna reserva detrás.
    return { ok: false, error: "sin_reservas" };
  }

  await db.customerLoginCode.delete({ where: { id: loginCode.id } });
  await setCustomerSessionCookie(customer.id);

  return { ok: true };
}

export async function logoutCustomer(): Promise<void> {
  await clearCustomerSessionCookie();
  redirect("/");
}
