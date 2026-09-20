import Link from "next/link";
import type { AlertaCampanha, RankingVendas, Recomendacao } from "@/lib/inteligencia";
import { RESULTADO, type TipoResultado } from "@/lib/resultados";
import type { MudancaDiario } from "@/lib/diario";
import type { Benchmark } from "@/lib/benchmark";

/**
 * O que fazer agora, antes das tabelas: cada recomendação traz o motivo em
 * números e a ação sugerida. É leitura de operação, não enfeite — por isso a
 * ordem é por importância, e não por gasto.
 */

const TOM: Record<Recomendacao["categoria"], { rotulo: string; classe: string }> = {
  vendendo: { rotulo: "Vendendo", classe: "border-ok text-ok" },
  escalar: { rotulo: "Escalar", classe: "border-ok text-ok" },
  cansado: { rotulo: "Cansado", classe: "border-alerta text-alerta" },
  cortar: { rotulo: "Cortar", classe: "border-alerta text-alerta" },
  atencao: { rotulo: "Atenção", classe: "border-borda text-suave" },
  sem_dados: { rotulo: "Sem dados", classe: "border-borda text-suave" },
};

export function Inteligencia({
  recomendacoes,
  alertas,
  custoMediano,
  tipoMediano,
  dias,
}: {
  recomendacoes: Recomendacao[];
  alertas: AlertaCampanha[];
  custoMediano: number | null;
  tipoMediano: TipoResultado | null;
  dias: number;
}) {
  if (recomendacoes.length === 0 && alertas.length === 0) return null;

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">O que fazer agora</h2>
        <p className="text-xs text-suave">
          Últimos {dias} dias contra os {dias} anteriores
          {custoMediano != null && tipoMediano
            ? ` · custo médio ${RESULTADO[tipoMediano].custo} na conta: ${custoMediano.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
            : ""}
        </p>
      </div>

      {alertas.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {alertas.map((a, i) => (
            <li key={i} className="rounded-2xl border border-alerta bg-alerta-suave px-3.5 py-3">
              <p className="text-sm font-medium text-alerta">
                {a.titulo} · <span className="font-normal">{a.campanha}</span>
              </p>
              <p className="mt-0.5 text-sm text-texto">{a.motivo}</p>
              <p className="mt-1 text-sm text-suave">{a.acao}</p>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {recomendacoes.map((r) => {
          const tom = TOM[r.categoria];
          return (
            <li key={`${r.categoria}-${r.adId}`} className="flex flex-col rounded-2xl border border-borda bg-superficie p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.nome}</p>
                  {r.campanha && <p className="truncate text-xs text-suave">{r.campanha}</p>}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${tom.classe}`}>
                  {tom.rotulo}
                </span>
              </div>

              <p className="mt-2 text-sm font-medium">{r.titulo}</p>
              <p className="mt-0.5 text-sm text-suave">{r.motivo}</p>

              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-borda pt-3 text-sm sm:grid-cols-3">
                {r.numeros.map((n) => (
                  <div key={n.rotulo}>
                    <dt className="text-[11px] text-suave">{n.rotulo}</dt>
                    <dd className="font-semibold">{n.valor}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 text-sm">{r.acao}</p>
              <Link href={`/leads?ad=${r.adId}`} className="mt-2 text-sm text-marca-texto">
                Ver os contatos deste anúncio
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Ranking por custo por venda.
 *
 * O custo por lead diz quem é barato; esse diz quem é lucrativo. Só aparece
 * quando há venda marcada no funil — sem isso o número não existiria, e chutar
 * seria pior do que não mostrar nada.
 */
export function PorVenda({ vendas }: { vendas: RankingVendas }) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Custo por venda</h2>
        <p className="text-xs text-suave">
          {brl(vendas.gasto)} investidos · {vendas.fechados}{" "}
          {vendas.fechados === 1 ? "venda" : "vendas"}
          {vendas.cac != null ? ` · ${brl(vendas.cac)} por venda` : ""}
          {vendas.roas != null
            ? ` · ${vendas.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x de retorno`
            : ""}
        </p>
      </div>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-borda bg-superficie">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-xs text-suave">
            <tr className="border-b border-borda">
              <th className="px-3 py-2 font-medium">Anúncio</th>
              <th className="px-3 py-2 text-right font-medium">Investido</th>
              <th className="px-3 py-2 text-right font-medium">Contatos</th>
              <th className="px-3 py-2 text-right font-medium">Vendas</th>
              <th className="px-3 py-2 text-right font-medium">Custo/venda</th>
              <th className="px-3 py-2 text-right font-medium">Receita</th>
            </tr>
          </thead>
          <tbody>
            {vendas.linhas.map((l) => (
              <tr key={l.adId} className="border-b border-borda last:border-0">
                <td className="max-w-[16rem] px-3 py-2">
                  <p className="truncate">{l.nome}</p>
                  {l.campanha && <p className="truncate text-xs text-suave">{l.campanha}</p>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(l.gasto)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.contatos}
                  {l.conversao != null && l.fechados > 0 && (
                    <span className="ml-1 text-xs text-suave">
                      ({Math.round(l.conversao * 100)}%)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{l.fechados}</td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    l.cac == null ? "text-suave" : l.roas != null && l.roas >= 1 ? "text-ok" : ""
                  }`}
                >
                  {l.cac != null ? brl(l.cac) : "sem venda"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.receita > 0 ? brl(l.receita) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vendas.gastoSemVenda > 0 && (
        <p className="mt-2 text-xs text-suave">
          {brl(vendas.gastoSemVenda)} foram para anúncios que ainda não fecharam venda no período.
          Só conta a venda marcada no funil: contato sem etapa atualizada não aparece aqui.
        </p>
      )}
    </section>
  );
}

/**
 * Diário de otimização: a linha do tempo do que foi mexido e o que veio depois.
 * A comparação é 7 dias antes contra 7 dias depois — não prova causa, mas tira
 * a conversa do "acho que melhorou".
 */
export function Diario({ mudancas }: { mudancas: MudancaDiario[] }) {
  if (mudancas.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
        Diário de otimização
      </h2>
      <p className="mt-0.5 text-xs text-suave">
        Sete dias antes contra sete dias depois de cada mudança registrada.
      </p>

      <ol className="mt-2 flex flex-col gap-2">
        {mudancas.map((m) => (
          <li key={m.id} className="rounded-2xl border border-borda bg-superficie p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-medium text-marca-texto">
                {m.tipo}
              </span>
              <span className="text-xs text-suave">
                {m.em.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
            <p className="mt-1 text-sm [overflow-wrap:anywhere]">{m.descricao}</p>
            <p
              className={`mt-1 text-sm ${
                m.efeito?.variacao != null && m.efeito.variacao <= -0.1
                  ? "text-ok"
                  : m.efeito?.variacao != null && m.efeito.variacao >= 0.1
                    ? "text-alerta"
                    : "text-suave"
              }`}
            >
              {m.efeito ? m.efeito.resumo : "Ainda dentro dos 7 dias: o efeito aparece depois."}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** O cliente contra o resto da carteira, sem média de internet. */
export function Comparacao({ b }: { b: Benchmark }) {
  return (
    <section className="mt-4">
      <div
        className={`rounded-2xl border px-3.5 py-3 ${
          b.posicao === "melhor"
            ? "border-ok bg-ok-suave"
            : b.posicao === "pior"
              ? "border-alerta bg-alerta-suave"
              : "border-borda bg-superficie"
        }`}
      >
        <p className="text-sm font-medium">
          {b.posicao === "melhor"
            ? "Melhor que a média da carteira"
            : b.posicao === "pior"
              ? "Acima da média da carteira"
              : "Na média da carteira"}
          {b.nicho ? ` · ${b.nicho}` : ""}
        </p>
        <p className="mt-0.5 text-sm text-texto">{b.resumo}</p>
      </div>
    </section>
  );
}
