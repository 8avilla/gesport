"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ADMIN_ORG_COOKIE, requireSuperadminSession } from "@/lib/auth/session-guards";
import { db, isUniqueConstraintError } from "@/lib/db";

const createOrganizationSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2),
  adminName: z.string().trim().min(2),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminPassword: z.string().min(8),
});

// Crea una organización nueva junto con su primer usuario ADMIN, en una transacción — sin esto la
// organización quedaría inaccesible (nadie podría entrar a /:org/admin/usuarios para crear el
// primer usuario, huevo-y-gallina).
export async function createOrganization(formData: FormData): Promise<void> {
  await requireSuperadminSession();

  const parsed = createOrganizationSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    redirect("/superadmin?error=datos_invalidos");
  }

  const { slug, name, adminName, adminEmail, adminPassword } = parsed.data;

  const existingEmail = await db.user.findUnique({ where: { email: adminEmail } });
  if (existingEmail) {
    redirect("/superadmin?error=email_en_uso");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  try {
    await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { slug, name } });

      await tx.user.create({
        data: {
          orgId: organization.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/superadmin?error=slug_en_uso");
    }
    throw error;
  }

  redirect("/superadmin?ok=organizacion_creada");
}

// El superadmin no pertenece a ninguna organización, así que `/admin` (sin slug en la URL) no puede
// resolverla de la sesión — se guarda cuál eligió en una cookie httpOnly, leída por
// `requireAdminSession` en cada request a /admin/*. Se valida que el slug exista de verdad antes de
// guardarlo para no dejar la cookie apuntando a una organización inexistente.
export async function selectAdminOrg(formData: FormData): Promise<void> {
  await requireSuperadminSession();

  const orgSlug = formData.get("orgSlug");
  if (typeof orgSlug !== "string" || orgSlug.length === 0) {
    notFound();
  }

  const org = await db.organization.findUnique({ where: { slug: orgSlug }, select: { slug: true } });
  if (!org) {
    notFound();
  }

  (await cookies()).set(ADMIN_ORG_COOKIE, org.slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/admin/reservas");
}
