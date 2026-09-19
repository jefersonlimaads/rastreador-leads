"use client";

import { useActionState } from "react";
import { roteiroCowork } from "@/lib/pesquisa/roteiro";
import { BlocoCopiavel } from "../ajustes/copiar";
import { acaoGerarChaveImportacao, acaoRevogarChaveImportacao, type EstadoChave } from "./acoes";

const vazio: EstadoChave = {};

/**
 * Importação automática: a chave que o Cowork usa para mandar prospects e o
 * roteiro pronto da tarefa. A chave inteira só aparece logo depois de gerada.
 */
export function ImportacaoCowork({
  url,
  agencia,
  assinatura,
  chaveAtual,
}: {
  url: string;
  agencia: string;
  assinatura: string;
  chaveAtual: { fim: string; em: string } | null;
}) {
  const [estado, gerar, gerando] = useActionState(acaoGerarChaveImportacao, vazio);
  const nova = estado.chave;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {nova ? (
          <span className="text-ok">● Chave nova gerada. Copie agora: ela não aparece de novo.</span>
        ) : chaveAtual ? (
          <>
            <span className="text-ok">●</span> Chave ativa terminada em <strong>••••{chaveAtual.fim}</strong>, gerada em{" "}
            {chaveAtual.em}.
          </>
        ) : (
          <span className="text-suave">Nenhuma chave ainda.</span>
        )}
      </p>

      {nova && <BlocoCopiavel texto={nova} />}

      <div className="flex flex-wrap gap-2">
        <form action={gerar}>
          <button
            type="submit"
            disabled={gerando}
            className="rounded-xl bg-marca px-4 py-2 text-sm font-medium text-sobre-marca disabled:opacity-60"
          >
            {gerando ? "Gerando..." : chaveAtual || nova ? "Gerar nova chave" : "Gerar chave"}
          </button>
        </form>
        {(chaveAtual || nova) && (
          <form action={acaoRevogarChaveImportacao}>
            <button type="submit" className="rounded-xl border border-borda px-4 py-2 text-sm text-alerta">
              Revogar
            </button>
          </form>
        )}
      </div>
      {(chaveAtual || nova) && (
        <p className="text-xs text-suave">Gerar uma nova chave derruba a anterior na hora — as tarefas antigas param de enviar.</p>
      )}

      <details className="border-t border-borda pt-3" open={Boolean(nova)}>
        <summary className="cursor-pointer text-sm font-medium">Roteiro para a tarefa do Cowork</summary>
        <p className="mt-2 text-xs text-suave">
          Cole no Cowork e troque nicho, cidade e quantidade a cada rodada.
          {nova ? " A chave já está no roteiro." : " Gere uma chave para ela entrar no roteiro."}
        </p>
        <BlocoCopiavel texto={roteiroCowork({ url, chave: nova ?? "COLE_A_CHAVE_AQUI", agencia, assinatura })} />
      </details>
    </div>
  );
}
