"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestLoginCode, verifyLoginCode } from "@/lib/customer-auth/actions";

const ERROR_MESSAGES: Record<string, string> = {
  telefono_invalido: "Escribe un WhatsApp válido (10 dígitos).",
  codigo_invalido: "Código incorrecto o vencido.",
  sin_reservas: "No encontramos reservas con este número.",
  demasiados_intentos: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
};

export function CustomerLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleRequestCode() {
    setPending(true);
    setError(null);
    const result = await requestLoginCode(phone);
    setPending(false);
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error] ?? "No pudimos enviar el código. Intenta de nuevo.");
      return;
    }
    setDevCode(result.devCode ?? null);
    setStep("code");
  }

  async function handleVerifyCode() {
    setPending(true);
    setError(null);
    const result = await verifyLoginCode(phone, code);
    setPending(false);
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error] ?? "No pudimos verificar el código.");
      return;
    }
    router.refresh();
  }

  if (step === "phone") {
    return (
      <div className="mt-6 grid gap-3">
        <label className="grid gap-1 text-sm">
          WhatsApp
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10 dígitos"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={pending || phone.length !== 10}
          onClick={handleRequestCode}
          className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:bg-gray-300"
        >
          {pending ? "Enviando…" : "Enviar código por WhatsApp"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      <p className="text-sm text-gray-500">Te enviamos un código de 6 dígitos al {phone} por WhatsApp.</p>
      {devCode && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Modo prueba (WhatsApp aún no configurado): tu código es <strong>{devCode}</strong>.
        </p>
      )}
      <label className="grid gap-1 text-sm">
        Código
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="rounded-md border border-gray-300 px-3 py-2 tracking-widest"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={pending || code.length !== 6}
        onClick={handleVerifyCode}
        className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:bg-gray-300"
      >
        {pending ? "Verificando…" : "Confirmar código"}
      </button>
      <button type="button" onClick={() => setStep("phone")} className="text-sm text-gray-500 underline">
        Cambiar número
      </button>
    </div>
  );
}
