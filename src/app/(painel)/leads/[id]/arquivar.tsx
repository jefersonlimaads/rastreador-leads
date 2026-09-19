"use client";

import { useState } from "react";
import { acaoArquivarLead } from "../../acoes";

/** Botão discreto, com confirmação: tira o lead de todos os números. */
export function ArquivarLead({ leadId }: { leadId: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-sm text-suave underline">
        Excluir da contagem (teste ou cadastro errado)
      </button>
    );
  }
  return (
    <form action={acaoArquivarLead} className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-sm">
        O lead sai das listas, do pipeline e dos relatórios. Use para teste ou cadastro errado — contato
        real que não fechou é <strong>Perdido</strong>, não exclusão.
      </p>
      <input
        name="motivo"
        placeholder="Motivo (ex.: teste, duplicado)"
        className="rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca"
      />
      <div className="flex gap-2">
        <button type="submit" className="rounded-xl bg-alerta px-4 py-2.5 text-sm font-medium text-fundo">
          Excluir da contagem
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-borda px-4 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
