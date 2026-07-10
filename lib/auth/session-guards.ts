import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export const ADMIN_ORG_COOKIE = "admin_org_slug";

// SUPERADMIN no pertenece a ninguna organización — puede entrar al panel de cualquiera, así que se
// deja pasar sin comparar orgSlug. El resto de roles solo puede entrar a la suya.
export async function requireStaffSession(orgSlug: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.orgSlug !== orgSlug)) {
    redirect("/login");
  }
  return session;
}

// El panel admin vive en /admin (sin slug en la URL) — la organización se resuelve de la sesión:
// para ADMIN/EMPLOYEE es siempre la suya; para SUPERADMIN (que no pertenece a ninguna) se lee de la
// cookie httpOnly que escribe `selectAdminOrg` al elegir una organización en /superadmin. Esa cookie
// solo se confía cuando el rol es SUPERADMIN — un ADMIN normal ignora cualquier cookie existente.
export async function requireAdminSession(): Promise<{ session: Session; orgSlug: string }> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
    redirect("/login");
  }

  const orgSlug =
    session.user.role === "SUPERADMIN"
      ? ((await cookies()).get(ADMIN_ORG_COOKIE)?.value ?? null)
      : (session.user.orgSlug ?? null);

  if (!orgSlug) {
    redirect("/superadmin");
  }

  return { session, orgSlug };
}

// Para /superadmin — no recibe orgSlug porque el rol no pertenece a ninguna organización.
export async function requireSuperadminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    notFound();
  }
  return session;
}
