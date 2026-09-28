"use client";

import { useActionState } from "react";
import { Formulario } from "@/app/formulario";
import { DESCRICAO_DA_REGUA, PADRAO_DAS_REGUAS, type ChaveRegua } from "@/lib/reguas";
import { acaoSalvarRegua, type EstadoAjustes } from "./acoes";

const vazio: EstadoAjustes = {};
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;

const ORIGEM: Record<string, string> = {
  cliente: "só deste cliente",
  nicho: "do nicho",
  agencia: "da agência",
  padrao: "padrão",
};

/**
 * As réguas do diagnóstico, por cliente.
 *
 * Mostra de onde cada número vem porque herança invisível engana: o gestor
 * mexe achando que ajustou um cliente e ajustou todos, ou o contrário.
 */
export function Reguas({
  reguas,
  clienteNome,
}: {
  reguas: Record<ChaveRegua, { ruim: number; bom: number; origem: string }>;
  clienteNome: string;
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarRegua, vazio);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-suave">
        O que o painel considera ruim, regular e bom em cada etapa do funil de {clienteNome}. Os
        valores de mercado servem de partida; ajuste quando tiver histórico — régua errada manda
        trocar o criativo que estava funcionando.
      </p>

      {(Object.keys(PADRAO_DAS_REGUAS) as ChaveRegua[]).map((chave) => {
        const r = reguas[chave];
        const d = DESCRICAO_DA_REGUA[chave];
        const padrao = PADRAO_DAS_REGUAS[chave];

        return (
          <Formulario
            key={chave}
            acao={salvar}
            className="flex flex-col gap-2 rounded-xl border border-borda bg-fundo p-3"
          >
            <input type="hidden" name="chave" value={chave} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{d.titulo}</p>
              <span className="text-xs text-suave">{ORIGEM[r.origem] ?? r.origem}</span>
            </div>
            <p className="text-xs text-suave">{d.explica}</p>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-suave">
                Ruim abaixo de
                <div className="flex items-center gap-1">
                  <input
                    name="ruim"
                    inputMode="decimal"
                    defaultValue={pct(r.ruim)}
                    className="w-20 rounded-lg border border-borda bg-superficie px-2 py-1.5 text-sm text-texto"
                  />
                  <span className="text-sm">%</span>
                </div>
              </label>
              <label className="flex flex-col gap-1 text-xs text-suave">
                Bom a partir de
                <div className="flex items-center gap-1">
                  <input
                    name="bom"
                    inputMode="decimal"
                    defaultValue={pct(r.bom)}
                    className="w-20 rounded-lg border border-borda bg-superficie px-2 py-1.5 text-sm text-texto"
                  />
                  <span className="text-sm">%</span>
                </div>
              </label>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg border border-borda px-3 py-1.5 text-sm disabled:opacity-60"
              >
                Salvar
              </button>
              <span className="text-xs text-suave">
                padrão {pct(padrao.ruim)}% e {pct(padrao.bom)}%
              </span>
            </div>
          </Formulario>
        );
      })}

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}
      {estado.ok && <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>}
      <p className="text-xs text-suave">
        Voltar aos valores padrão apaga o ajuste e faz o cliente herdar de novo a régua do nicho ou
        da agência.
      </p>
    </div>
  );
}
