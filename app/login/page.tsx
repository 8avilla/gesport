import Image from "next/image";
import { loginAction } from "@/lib/auth-actions";

const ERROR_MESSAGES: Record<string, string> = {
  credenciales_invalidas: "Email o contraseña incorrectos.",
  demasiados_intentos: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <Image src="/logo.png" alt="Cancha Libre" width={1774} height={887} className="h-9 w-auto" priority />
      <h1 className="mt-6 text-xl font-semibold">Ingreso de personal</h1>
      <p className="mt-1 text-sm text-gray-500">Recepción y administración de Cancha Libre.</p>

      {error && ERROR_MESSAGES[error] && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{ERROR_MESSAGES[error]}</p>
      )}

      <form action={loginAction} className="mt-6 grid gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />

        <label className="grid gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Contraseña
          <input
            type="password"
            name="password"
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          Ingresar
        </button>
      </form>
    </main>
  );
}
