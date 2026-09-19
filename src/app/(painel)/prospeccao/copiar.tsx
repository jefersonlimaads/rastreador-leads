"use client";

import { useState } from "react";

export function BotaoCopiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sem permissão de área de transferência: o texto está na tela para copiar à mão.
        }
      }}
      className="rounded-xl border border-borda px-3.5 py-2 text-sm"
    >
      {copiado ? "Copiado" : rotulo}
    </button>
  );
}
