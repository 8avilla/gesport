import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  // Sin esto, Auth.js v5 rechaza el request con "UntrustedHost" (se ve para el usuario como el 500
  // genérico "There was a problem with the server configuration") en cualquier host que no sea
  // Vercel — necesario aquí porque se despliega detrás del proxy/dominio custom de Blastic.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.active) {
          return null;
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
          return null;
        }

        // SUPERADMIN no pertenece a ninguna organización (User.orgId es null para ese rol) — el
        // resto de roles sí, y si la organización fue borrada, el login falla en vez de dejar
        // pasar una sesión sin tenant válido.
        if (!user.orgId) {
          if (user.role !== "SUPERADMIN") {
            return null;
          }
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        }

        const organization = await db.organization.findUnique({ where: { id: user.orgId } });
        if (!organization) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          orgSlug: organization.slug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.orgId = user.orgId;
        token.orgSlug = user.orgSlug;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.orgId = token.orgId;
      session.user.orgSlug = token.orgSlug;
      return session;
    },
  },
});
