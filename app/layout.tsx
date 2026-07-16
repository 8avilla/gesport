import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cancha Libre",
  description: "Reserva canchas, paga tu abono y recibe la confirmación al instante.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-x-hidden antialiased`}
    >
      {/* overflow-x-hidden en html Y body: una tabla ancha (ej. la grilla de agenda de
          /admin/reservas) puede quedar contenida visualmente por su propio overflow-x-auto y aun
          así hacer que el documento entero sea arrastrable hacia los lados en mobile — el elemento
          raíz que realmente scrollea varía según el navegador, así que se cubren ambos sin afectar
          el scroll horizontal interno de esos contenedores. */}
      <body className="min-h-full overflow-x-hidden">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
