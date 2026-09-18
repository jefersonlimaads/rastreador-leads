import { ImageResponse } from "next/og";
import { propostaPublica } from "@/lib/propostas";
import { MARCA } from "@/lib/marca";

/** Prévia do link da proposta no WhatsApp: a capa do documento. */
export const alt = "Proposta jl.ads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await propostaPublica(token);

  const para = `Proposta para ${p?.cliente.nome ?? "você"}`;
  const titulo = p?.titulo ?? "Proposta comercial";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: MARCA.cores.grafite,
          color: MARCA.cores.offWhite,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 700 }}>
          <div style={{ display: "flex" }}>jl</div>
          <div style={{ display: "flex", color: MARCA.cores.lima }}>.</div>
          <div style={{ display: "flex" }}>ads</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 28, color: MARCA.cores.cinzaPedra, letterSpacing: 2 }}>
            {para.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            {titulo}
          </div>
          <div style={{ display: "flex", width: 84, height: 8, background: MARCA.cores.lima }} />
        </div>
      </div>
    ),
    size,
  );
}
