import { ImageResponse } from "next/og";

/**
 * Ícone da aba, gerado no build. Substitui o do Next.js que vinha por padrão.
 * Quando houver arquivo de logo, trocar por src/app/icon.png e apagar este.
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
          background: "#1f6feb",
          color: "#fff",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        JL
      </div>
    ),
    size,
  );
}
