"use client";

import { useState } from "react";

/**
 * O endereço para receber lead de fora, com um exemplo pronto para colar.
 *
 * O exemplo mostra os campos de origem de propósito: é mandando o `codigo` ou
 * o `fbclid` que a origem vira confirmada em vez de informada, e essa
 * diferença decide se a venda pode ser atribuída ao anúncio.
 */
export function EnderecoDeLeads({ url }: { url: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  const endereco = `${url}/api/leads`;
  const exemplo = `curl -X POST ${endereco} \\
  -H "Authorization: Bearer SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "leads": [{
      "clienteId": "ID_DO_CLIENTE",
      "nome": "Ana Prado",
      "telefone": "11988887777",
      "codigo": "K7RPW",
      "adId": "120250...",
      "utmCampaign": "[LEADS] SP",
      "campos": [{ "rotulo": "Empresa", "valor": "Forte Telecom" }]
    }]
  }'`;

  const copiar = async (texto: string, qual: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
    } catch {
      // Sem permissão: o texto está na tela para copiar à mão.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-suave">Endereço</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="break-all rounded-lg bg-fundo px-2.5 py-1.5 text-xs">{endereco}</code>
          <button
            type="button"
            onClick={() => copiar(endereco, "endereco")}
            className="rounded-lg border border-borda px-2.5 py-1.5 text-xs"
          >
            {copiado === "endereco" ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <details className="rounded-xl border border-borda bg-fundo p-3">
        <summary className="cursor-pointer text-sm">Ver um exemplo de envio</summary>
        <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-suave">{exemplo}</pre>
        <button
          type="button"
          onClick={() => copiar(exemplo, "exemplo")}
          className="mt-2 rounded-lg border border-borda px-2.5 py-1.5 text-xs"
        >
          {copiado === "exemplo" ? "Copiado" : "Copiar exemplo"}
        </button>
      </details>

      <p className="text-xs text-suave">
        Mandando o <code>codigo</code> que a pessoa levou na mensagem, ou o <code>fbclid</code>, a
        origem entra como <strong>confirmada</strong> e a venda pode ser atribuída ao anúncio. Só
        com <code>adId</code> ou UTM ela entra como <strong>informada</strong>: serve para agrupar
        por campanha, não para afirmar de onde veio a venda.
      </p>
    </div>
  );
}
