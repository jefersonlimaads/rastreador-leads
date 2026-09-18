import { ImageResponse } from "next/og";
import { MARCA } from "@/lib/marca";

/**
 * Ícone da aba. O guia manda usar "jl.ads" centralizado no bloco lima em
 * avatar e favicon, e o texto sobre lima é grafite.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icone() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: MARCA.cores.lima,
          color: MARCA.sobreLima,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: -0.5,
        }}
      >
        {MARCA.nome}
      </div>
    ),
    size,
  );
}
