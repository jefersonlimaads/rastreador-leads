"use client";

import { useActionState, useState } from "react";
import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { acaoLancarDespesa, acaoApagarDespesa, type EstadoNegocio } from "./acoes";

const vazio: EstadoNegocio = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Lançar o que sai. Sem isso a margem é chute: fee alto passa por cliente bom
 * mesmo com um freelancer comendo metade dele.
 */
export function Despesas({
  despesas,
  clientes,
  categorias,
  competencia,
}: {
  despesas: {
    id: string;
    descricao: string;
    categoria: string | null;
    valor: number;
    pagoEm: Date | null;
    recorrente: boolean;
    cliente: { nome: string } | null;
  }[];
  clientes: { id: string; nome: string }[];
  categorias: readonly string[];
  competencia: string;
}) {
  const [estado, lancar, lancando] = useActionState(acaoLancarDespesa, vazio);
  const chave = useLimparAoConcluir(estado);
  const [aberto, setAberto] = useState(false);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setAberto(false);
  }

  const total = despesas.reduce((s, d) => s + d.valor, 0);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Despesas do mês</h2>
        <p className="text-sm font-semibold">{moeda(total)}</p>
      </div>

      {despesas.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {despesas.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm [overflow-wrap:anywhere]">
                  {d.descricao}
                  {d.recorrente && <span className="ml-2 text-xs text-suave">todo mês</span>}
                </p>
                <p className="text-xs text-suave">
                  {[d.categoria, d.cliente?.nome, d.pagoEm ? "pago" : "em aberto"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="font-medium tabular-nums">{moeda(d.valor)}</span>
                <form action={acaoApagarDespesa}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-xs text-alerta" title="Apagar">
                    apagar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {aberto ? (
        <Formulario
          key={chave}
          acao={lancar}
          className="mt-2 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
        >
          <input type="hidden" name="competencia" value={competencia} />
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
            <input name="descricao" required autoFocus placeholder="O que foi pago" className={campo} />
            <input name="valor" required inputMode="decimal" placeholder="800,00" className={campo} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select name="categoria" defaultValue="Outro" className={campo}>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="clienteId" defaultValue="" className={campo}>
              <option value="">Despesa da agência</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recorrente" value="1" className="size-4 accent-marca" />
            Repete todo mês
          </label>
          {estado.erro && (
            <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={lancando}
              className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
            >
              {lancando ? "Salvando..." : "Lançar"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-borda px-4 py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </Formulario>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-2 w-full rounded-xl border border-dashed border-borda px-4 py-2.5 text-sm text-suave hover:border-marca hover:text-texto"
        >
          + Lançar despesa
        </button>
      )}
    </section>
  );
}
