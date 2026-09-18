import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rastreador de leads — JL Ads",
  description: "Painel de leads, atribuição por anúncio e custo real por cliente.",
};

/**
 * A função roda em São Paulo, junto do banco. Sem isto a Vercel executa em
 * Washington por padrão, e cada consulta atravessa o continente duas vezes:
 * eram cerca de 120 ms por consulta, com várias consultas por tela.
 */
export const preferredRegion = "gru1";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6feb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
