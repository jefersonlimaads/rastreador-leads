"use client";

import { useState } from "react";

/** Texto para colar em outro lugar (anúncio, site), com botão de copiar. */
export function BlocoCopiavel({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-2">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-fundo p-3 text-xs">{texto}</pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            // Sem permissão de área de transferência: o texto está visível para copiar à mão.
          }
        }}
        className="mt-2 rounded-xl border border-borda px-3 py-1.5 text-sm"
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
