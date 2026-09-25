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

/** Categorias que pedem mudança. "Vendendo" e "sem dados" viram selo na tabela. */
const PEDEM_ACAO = new Set<Recomendacao["categoria"]>(["escalar", "cansado", "cortar", "atencao"]);

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
  /*
   * Só o que pede mudança. Antes, anúncio saudável virava card de "o que fazer
   * agora" dizendo "mantenha no ar" — quatro cartões grandes para não fazer
   * nada, e o que realmente precisava de ação ficava perdido no meio.
   */
  const acoes = recomendacoes.filter((r) => PEDEM_ACAO.has(r.categoria));

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          O que mudar agora
        </h2>
        <p className="text-xs text-suave">
          {dias} dias contra os {dias} anteriores
          {custoMediano != null && tipoMediano
            ? ` · custo médio ${RESULTADO[tipoMediano].custo} na conta: ${custoMediano.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
            : ""}
        </p>
      </div>

      {alertas.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {alertas.map((a, i) => (
            <li key={i} className="rounded-2xl border border-alerta bg-alerta-suave px-4 py-3">
              <p className="text-sm font-medium text-alerta">
                {a.titulo} · <span className="font-normal">{a.campanha}</span>
              </p>
              <p className="mt-0.5 text-sm text-texto">{a.motivo}</p>
              <p className="mt-1 text-sm text-suave">{a.acao}</p>
            </li>
          ))}
        </ul>
      )}

      {acoes.length === 0 ? (
        alertas.length === 0 && (
          <p className="mt-2 rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
            Nada pedindo mudança nos últimos {dias} dias. O desempenho de cada anúncio está na
            tabela abaixo.
          </p>
        )
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {acoes.map((r) => {
            const tom = TOM[r.categoria];
            return (
              <li
                key={`${r.categoria}-${r.adId}`}
                className="rounded-2xl border border-borda bg-superficie p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tom.classe}`}>
                    {tom.rotulo}
                  </span>
                  <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{r.nome}</p>
                  {r.campanha && <span className="text-xs text-suave">{r.campanha}</span>}
                </div>

                <p className="mt-2 text-sm text-suave">{r.motivo}</p>
                <p className="mt-1.5 text-sm font-medium">{r.acao}</p>

                {/* Só os números que sustentam a decisão: gasto, resultado e preço. */}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
                  {r.numeros.slice(0, 4).map((n) => (
                    <span key={n.rotulo}>
                      {n.rotulo}: <span className="font-medium text-texto">{n.valor}</span>
                    </span>
                  ))}
                </p>

                <Link href={`/leads?ad=${r.adId}`} className="mt-2 inline-block text-sm text-marca-texto">
                  Ver os contatos deste anúncio
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Uma linha por anúncio, com o diagnóstico ao lado do número.
 *
 * Antes eram duas tabelas e uma pilha de cartões mostrando os mesmos cinco
 * anúncios: "custo por venda" embaixo dos cartões, e outra tabela no rodapé
 * com quase as mesmas colunas. Aqui é uma só, na ordem em que se decide:
 * quanto saiu, o que voltou, e quanto custou cada coisa.
 */
export function TabelaAnuncios({
  linhas,
  diagnostico,
  rotuloNivel,
  vendas,
}: {
  linhas: {
    chave: string;
    rotulo: string;
    leads: number;
    fechados: number;
    gasto: number;
    cpl: number | null;
    cac: number | null;
    roas: number | null;
  }[];
  diagnostico: Map<string, Recomendacao["categoria"]>;
  rotuloNivel: string;
  vendas: RankingVendas | null;
}) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          Desempenho por {rotuloNivel.toLowerCase()}
        </h2>
        {vendas && (
          <p className="text-xs text-suave">
            {brl(vendas.gasto)} investidos · {vendas.fechados}{" "}
            {vendas.fechados === 1 ? "venda" : "vendas"}
            {vendas.cac != null ? ` · ${brl(vendas.cac)} por venda` : ""}
            {vendas.roas != null
              ? ` · ${vendas.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x de retorno`
              : ""}
          </p>
        )}
      </div>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-borda bg-superficie">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-suave">
              <th className="px-3 py-2.5">{rotuloNivel}</th>
              <th className="px-3 py-2.5 text-right">Investido</th>
              <th className="px-3 py-2.5 text-right">Contatos</th>
              <th className="px-3 py-2.5 text-right">Custo/contato</th>
              <th className="px-3 py-2.5 text-right">Vendas</th>
              <th className="px-3 py-2.5 text-right">Custo/venda</th>
              <th className="px-3 py-2.5 text-right">Retorno</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const categoria = diagnostico.get(l.chave);
              const tom = categoria ? TOM[categoria] : null;
              return (
                <tr key={l.chave} className="border-b border-borda last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/leads?ad=${l.chave}`} className="font-medium">
                      {l.rotulo}
                    </Link>
                    {tom && (
                      <span
                        className={`ml-2 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${tom.classe}`}
                      >
                        {tom.rotulo}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{brl(l.gasto)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.leads}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l.cpl != null ? brl(l.cpl) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{l.fechados}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l.cac != null ? brl(l.cac) : <span className="text-suave">sem venda</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l.roas != null ? `${l.roas.toFixed(1)}x` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {vendas && vendas.gastoSemVenda > 0 && (
        <p className="mt-2 text-xs text-suave">
          {brl(vendas.gastoSemVenda)} foram para anúncios que ainda não fecharam venda no período.
          Só conta a venda marcada no funil.
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
