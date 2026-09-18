import { ImageResponse } from "next/og";
import { clientePorToken, totalPendencias } from "@/lib/confirmacao";
import { MARCA } from "@/lib/marca";

/**
 * Imagem que aparece na prévia do link no WhatsApp. Segue o guia: fundo
 * grafite, texto off-white, e o lima só no ponto do logo e no marcador — é o
 * acento, não a cor da peça.
 */
export const alt = `Leads para confirmar — ${MARCA.nome}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cliente = await clientePorToken(token);
  const pendentes = cliente ? await totalPendencias(cliente.id) : 0;

  // O gerador exige um filho de texto por div: textos prontos antes.
  const titulo =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? "lead esperando" : "leads esperando"} sua resposta`
      : "Seus leads estão em dia";
  const subtitulo = `${cliente?.nome ?? "Confirmação de leads"} · leva menos de um minuto`;

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
          <div style={{ display: "flex", width: 84, height: 8, background: MARCA.cores.lima }} />
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            {titulo}
          </div>
          <div style={{ fontSize: 34, color: MARCA.cores.cinzaPedra }}>{subtitulo}</div>
        </div>
      </div>
    ),
    size,
  );
}
