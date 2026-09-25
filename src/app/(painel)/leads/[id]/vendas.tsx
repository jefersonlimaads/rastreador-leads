"use client";

import { useActionState, useState } from "react";
import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { acaoApagarVenda, acaoRegistrarVenda, type EstadoVenda } from "../../acoes";

const vazio: EstadoVenda = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * As vendas do lead. O mesmo cliente compra de novo, e esse faturamento veio
 * da mesma mídia — por isso soma aqui, em vez de virar outro lead, que
 * contaria um contato que nunca chegou.
 */
export function Vendas({
  leadId,
  vendas,
  fuso,
}: {
  leadId: string;
  vendas: { id: string; valor: number; descricao: string | null; fechadoEm: Date }[];
  fuso?: string;
}) {
  const [estado, registrar, registrando] = useActionState(acaoRegistrarVenda, vazio);
  const chave = useLimparAoConcluir(estado);
  const [aberto, setAberto] = useState(false);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setAberto(false);
  }

  const total = vendas.reduce((s, v) => s + v.valor, 0);
  const data = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: fuso });

  return (
    <section className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          {vendas.length > 1 ? `${vendas.length} vendas` : "Venda"}
        </h2>
        <p className="font-titulo text-lg font-bold">{moeda(total)}</p>
      </div>

      {vendas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {vendas.map((v) => (
            <li key={v.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {v.descricao ?? "Venda"}
                <span className="ml-2 text-xs text-suave">{data(v.fechadoEm)}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="font-medium">{moeda(v.valor)}</span>
                {vendas.length > 1 && (
                  <form action={acaoApagarVenda}>
                    <input type="hidden" name="id" value={v.id} />
                    <button type="submit" className="text-xs text-alerta" title="Apagar esta venda">
                      apagar
                    </button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {aberto ? (
        <Formulario key={chave} acao={registrar} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <input name="valor" inputMode="decimal" required autoFocus placeholder="2000,00" className={campo} />
            <input name="descricao" placeholder="O que foi vendido (opcional)" className={campo} />
          </div>
          {estado.erro && (
            <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={registrando}
              className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
            >
              {registrando ? "Salvando..." : "Registrar"}
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
          className="mt-3 w-full rounded-xl border border-dashed border-borda px-4 py-2.5 text-sm text-suave hover:border-marca hover:text-texto"
        >
          + Registrar outra venda
        </button>
      )}
    </section>
  );
}
