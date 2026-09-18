import { ImageResponse } from "next/og";
import { clientePorToken, totalPendencias } from "@/lib/confirmacao";

/**
 * Imagem que aparece na prévia do link no WhatsApp. Sem isso, o cliente recebe
 * um link cru e a chance de ele abrir cai.
 */
export const alt = "Leads para confirmar — JL Ads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cliente = await clientePorToken(token);
  const pendentes = cliente ? await totalPendencias(cliente.id) : 0;

  // O gerador de imagem exige um filho de texto por div: textos prontos antes.
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
          background: "#0d0f12",
          color: "#f2f4f7",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "#1f6feb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            JL
          </div>
          <div style={{ fontSize: 34, color: "#98a2b0" }}>JL Ads</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{titulo}</div>
          <div style={{ fontSize: 34, color: "#98a2b0" }}>{subtitulo}</div>
        </div>
      </div>
    ),
    size,
  );
}
