"use client";

import { useState } from "react";
import { acaoDefinirAcesso } from "./acoes";

/**
 * Quais clientes o colaborador alcança.
 *
 * Nenhum marcado significa todos, e a tela diz isso: um conjunto vazio que
 * tranca a pessoa para fora seria a leitura oposta, e o administrador
 * descobriria pelo colaborador reclamando que o painel está vazio.
 */
export function AcessoDoColaborador({
  usuarioId,
  clientes,
  liberados,
}: {
  usuarioId: string;
  clientes: { id: string; nome: string }[];
  liberados: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const semRestricao = liberados.length === 0;

  if (clientes.length === 0) return null;

  return (
    <div className="mt-2 border-t border-borda pt-2">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="text-xs text-marca-texto"
      >
        {semRestricao
          ? `Vê todos os ${clientes.length} clientes`
          : `Vê ${liberados.length} de ${clientes.length} clientes`}
        {aberto ? " · fechar" : " · mudar"}
      </button>

      {aberto && (
        <form action={acaoDefinirAcesso} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="usuarioId" value={usuarioId} />
          <div className="flex flex-col gap-1">
            {clientes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="clientes"
                  value={c.id}
                  defaultChecked={liberados.includes(c.id)}
                  className="size-4 accent-marca"
                />
                <span className="min-w-0 truncate">{c.nome}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-suave">
            Nenhum marcado: vê todos. Marque para restringir.
          </p>
          <button
            type="submit"
            className="self-start rounded-lg bg-marca px-3 py-1.5 text-xs font-medium text-sobre-marca"
          >
            Salvar acesso
          </button>
        </form>
      )}
    </div>
  );
}
