import { Prisma, PrismaClient } from "./generated/prisma";

declare global {
  var prismaClient: InstanceType<typeof PrismaClient> | undefined;
}

export const db = globalThis.prismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = db;
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002";
  }
  // Respaldo por si el bundling duplica el módulo de Prisma (visto en dev con Turbopack tras hot
  // reloads) y el `instanceof` de arriba no reconoce el error aunque sí sea un P2002 real — el
  // código de error siempre está presente en el objeto, sin importar de qué copia de la clase venga.
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}
