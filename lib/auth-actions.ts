"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function loginAction(formData: FormData): Promise<void> {
  const rawCallbackUrl = String(formData.get("callbackUrl") || "/");
  // "/" es el buscador público, no una pantalla de staff — tratarlo como "no pidieron una página en
  // particular" y decidir el destino según el rol una vez sepamos quién inició sesión (un SUPERADMIN
  // no tiene organización a la que volver).
  const explicitCallbackUrl = rawCallbackUrl !== "/" ? rawCallbackUrl : undefined;

  const ip = await getClientIp();
  if (!checkRateLimit(`login:${ip}`, 5, 5 * 60_000)) {
    redirect(`/login?error=demasiados_intentos&callbackUrl=${encodeURIComponent(rawCallbackUrl)}`);
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
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

  const session = await auth();
  if (session?.user?.role === "SUPERADMIN") {
    redirect("/superadmin");
  }
  // EMPLOYEE no tiene acceso al panel admin — su pantalla por defecto es POS (ver proxy.ts, que
  // bloquea /admin para cualquier rol distinto de ADMIN/SUPERADMIN).
  redirect(session?.user?.role === "ADMIN" ? "/admin" : `/${session?.user?.orgSlug}/pos`);
}

// No había ningún punto de salida en toda la app — signOut estaba exportado desde lib/auth.ts pero
// nunca usado en ninguna pantalla.
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
