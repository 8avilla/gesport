import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Customer } from "@/lib/generated/prisma";

// Sesión de cliente final (login por WhatsApp, sin contraseña) — separada del NextAuth de staff en
// lib/auth.ts a propósito: son identidades distintas (Customer vs. User/rol), y no tiene sentido
// meter un provider nuevo en NextAuth solo para esto. Cookie firmada a mano con HMAC-SHA256, mismo
// patrón ya revisado en lib/payments/bold.ts (verifyWebhookSignature) — reutiliza AUTH_SECRET, que
// ya existe, en vez de sumar una variable de entorno nueva.
const COOKIE_NAME = "customer_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 días

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function signCustomerSession(customerId: string): string {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${customerId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyCustomerSessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [customerId, expiresAtRaw, signatureHex] = parts;
  const payload = `${customerId}.${expiresAtRaw}`;

  const expected = Buffer.from(sign(payload), "hex");
  const received = Buffer.from(signatureHex, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  return customerId;
}

export async function setCustomerSessionCookie(customerId: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, signCustomerSession(customerId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCustomerSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getCustomerSession(): Promise<Customer | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const customerId = verifyCustomerSessionToken(token);
  if (!customerId) return null;

  return db.customer.findUnique({ where: { id: customerId } });
}
