import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Convención Next 16: `middleware.ts` está deprecado a favor de `proxy.ts` (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  // /admin (sin slug de organización) — la organización se resuelve dentro de cada página vía
  // requireAdminSession (sesión propia para ADMIN, cookie de impersonación para SUPERADMIN). Acá
  // solo se exige sesión válida con rol habilitado; sin esto, /admin/* quedaría sin protección
  // porque el regex de /:org/(pos|admin) de abajo no matchea una ruta sin slug delante.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // POS conserva el slug de organización en la URL — no fue parte del cambio a /admin sin slug.
  const staffMatch = pathname.match(/^\/([^/]+)\/pos(\/|$)/);
  if (!staffMatch) {
    return NextResponse.next();
  }

  const [, orgSlugInUrl] = staffMatch;

  if (!session?.user) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // SUPERADMIN no pertenece a ninguna organización (session.user.orgSlug queda undefined) — puede
  // entrar a la de cualquiera, así que se salta la comparación de slug.
  const isSuperadmin = session.user.role === "SUPERADMIN";

  if (!isSuperadmin && session.user.orgSlug !== orgSlugInUrl) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/:org/pos/:path*", "/admin", "/admin/:path*"],
};
