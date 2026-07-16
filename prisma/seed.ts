import bcrypt from "bcryptjs";
import { db } from "../lib/db";

const SEED_PASSWORD = "cuna2026";

async function main() {
  const organization = await db.organization.upsert({
    where: { slug: "cunadelgol" },
    update: {},
    create: {
      slug: "cunadelgol",
      name: "La Cuna del Gol",
      timezone: "America/Bogota",
      depositPercentage: 50,
      cancellationWindowHours: 24,
      bookingHoldMinutes: 15,
    },
  });

  const venues = [
    { name: "Cancha 1 — Fútbol 7", type: "FUTBOL_7" as const, hourlyRate: 160_000 },
    { name: "Cancha 2 — Fútbol 7", type: "FUTBOL_7" as const, hourlyRate: 160_000 },
    { name: "Cancha 3 — Fútbol 9", type: "FUTBOL_9" as const, hourlyRate: 250_000 },
  ];

  for (const venue of venues) {
    const existing = await db.venue.findFirst({ where: { orgId: organization.id, name: venue.name } });
    if (!existing) {
      await db.venue.create({ data: { ...venue, orgId: organization.id } });
    }
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const users = [
    { name: "Administrador", email: "admin@cunadelgol", role: "ADMIN" as const },
    { name: "Recepción Turno Día", email: "recepcion@cunadelgol", role: "EMPLOYEE" as const },
  ];

  for (const user of users) {
    await db.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, orgId: organization.id, passwordHash },
    });
  }

  const products = [
    { name: "Agua 600ml", price: 3_000, stock: 100 },
    { name: "Gatorade", price: 6_000, stock: 60 },
    { name: "Cerveza", price: 8_000, stock: 80 },
    { name: "Alquiler petos", price: 10_000, stock: 20 },
  ];

  for (const product of products) {
    const existing = await db.consumptionItem.findFirst({ where: { orgId: organization.id, name: product.name } });
    if (!existing) {
      await db.consumptionItem.create({ data: { ...product, orgId: organization.id } });
    }
  }

  await db.user.upsert({
    where: { email: "superadmin@plataforma.test" },
    update: {},
    create: {
      name: "Superadmin Plataforma",
      email: "superadmin@plataforma.test",
      role: "SUPERADMIN",
      passwordHash,
    },
  });

  const allTestEmails = [...users.map((u) => u.email), "superadmin@plataforma.test"];

  console.log(`Seed listo: organización "${organization.slug}" con ${venues.length} canchas.`);
  console.log(`Usuarios de prueba (contraseña "${SEED_PASSWORD}"): ${allTestEmails.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
