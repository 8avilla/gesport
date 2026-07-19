"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

// Destino post-login según rol — compartido entre loginAction (recién autenticado) y la página de
// login (ya tenía sesión y no necesita volver a loguearse, ver app/login/page.tsx).
export async function resolvePostLoginDestination(user: { role: string; orgId?: string | null }): Promise<string> {
  if (user.role === "SUPERADMIN") {
    return "/superadmin";
  }
  // EMPLOYEE no tiene acceso al panel admin — su pantalla por defecto es POS (ver proxy.ts, que
  // bloquea /admin para cualquier rol distinto de ADMIN/SUPERADMIN).
  if (user.role === "ADMIN") {
    return "/admin/reservas";
  }
  const organization = user.orgId ? await db.organization.findUnique({ where: { id: user.orgId } }) : null;
  return `/${organization?.slug}/pos`;
}

export async function loginAction(formData: FormData): Promise<void> {
  const rawCallbackUrl = String(formData.get("callbackUrl") || "/");
  // "/" es el buscador público, no una pantalla de staff — tratarlo como "no pidieron una página en
  // particular" y decidir el destino según el rol una vez sepamos quién inició sesión (un SUPERADMIN
  // no tiene organización a la que volver).
  const explicitCallbackUrl = rawCallbackUrl !== "/" ? rawCallbackUrl : undefined;
  const email = String(formData.get("email") || "");

  const ip = await getClientIp();
  if (!checkRateLimit(`login:${ip}`, 5, 5 * 60_000)) {
    redirect(`/login?error=demasiados_intentos&callbackUrl=${encodeURIComponent(rawCallbackUrl)}`);
  }

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=credenciales_invalidas&callbackUrl=${encodeURIComponent(rawCallbackUrl)}`);
    }
    throw error;
  }

  if (explicitCallbackUrl) {
    redirect(explicitCallbackUrl);
  }

  // No usar auth() acá: signIn() de arriba recién está dejando la cookie de sesión en el response de
  // esta misma server action — auth() leído en el mismo request todavía no la ve (queda undefined),
  // lo que mandaba a todos a `/undefined/pos` y obligaba a un segundo click para "ahora sí" entrar
  // (la segunda vez ya es un request nuevo, con la cookie puesta). En vez de depender de esa
  // relectura, resolvemos el destino con los mismos datos que authorize() ya validó.
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    redirect("/login");
  }
  redirect(await resolvePostLoginDestination(user));
}

// No había ningún punto de salida en toda la app — signOut estaba exportado desde lib/auth.ts pero
// nunca usado en ninguna pantalla.
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
