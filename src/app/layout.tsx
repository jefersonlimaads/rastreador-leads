import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Fontes do guia: Space Grotesk nos títulos, Inter no corpo.
const titulo = Space_Grotesk({ variable: "--font-titulo", subsets: ["latin"] });
const texto = Inter({ variable: "--font-texto", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rastreador de leads — jl.ads",
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
  themeColor: "#141414",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
