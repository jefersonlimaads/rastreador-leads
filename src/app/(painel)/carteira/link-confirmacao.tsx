"use client";

import { useState, useTransition } from "react";
import { acaoLinkConfirmacao } from "../acoes";

/**
 * Entrega o link de confirmação pronto para mandar ao cliente. Copiar é o gesto
 * principal; o WhatsApp abre com a mensagem montada para quem prefere.
 */
export function LinkConfirmacao({
  clienteId,
  pendencias,
  numero,
}: {
  clienteId: string;
  pendencias: number;
  numero: string | null;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [buscando, iniciar] = useTransition();

  function pegar() {
    iniciar(async () => {
      const url = await acaoLinkConfirmacao(clienteId);
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
      } catch {
        // Sem permissão de área de transferência: o link fica visível na tela.
      }
    });
  }

  const texto = `Oi! Pode conferir os leads de hoje? Leva menos de um minuto: ${link ?? ""}`;

  return (
    <div className="mt-3 border-t border-borda pt-3">
      {!link ? (
        <button type="button" onClick={pegar} disabled={buscando} className="text-sm text-marca">
          {buscando ? "Gerando..." : `Link de confirmação do cliente${pendencias > 0 ? ` (${pendencias} pendentes)` : ""}`}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="break-all rounded-xl bg-fundo px-3 py-2 text-xs text-suave">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopiado(true);
              }}
              className="rounded-xl border border-borda px-3 py-2 text-sm"
            >
              {copiado ? "Copiado" : "Copiar link"}
            </button>
            {numero && (
              <a
                href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-marca px-3 py-2 text-sm font-medium text-white"
              >
                Mandar no WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
