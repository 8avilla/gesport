import type { UserRole } from "@/lib/generated/prisma";

declare module "next-auth" {
  interface User {
    role: UserRole;
    // Undefined solo para SUPERADMIN (rol global de plataforma, sin organización propia).
    orgId?: string;
    orgSlug?: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      orgId?: string;
      orgSlug?: string;
    };
  }
}

// `next-auth/jwt` solo re-exporta desde `@auth/core/jwt` (`export *`), así que el merge de tipos
// tiene que apuntar al módulo original o TypeScript no lo aplica.
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    orgId?: string;
    orgSlug?: string;
  }
}
