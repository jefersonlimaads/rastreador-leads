import type { Relatorio, Totais } from "@/lib/relatorio";
import { ROTULO_STATUS } from "@/lib/regras";

/**
 * O relatório como o cliente vê. Mesmo componente na prévia do painel e no
 * link enviado: o que você confere é exatamente o que ele recebe.
 *
 * Ordem de leitura de dono de negócio: quanto investiu, quanto voltou em
 * contatos e vendas, se melhorou ou piorou, e só depois o detalhe por campanha.
 */

const moeda = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null, casas = 1) =>
  v == null ? "—" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas }) + "%";
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataLonga = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Logo da agência: o ponto do nome ganha a cor de destaque, como em "jl.ads". */
function Logo({ nome }: { nome: string }) {
  const i = nome.indexOf(".");
  if (i <= 0) return <span>{nome}</span>;
  return (
    <span>
      {nome.slice(0, i)}
      <span className="text-[#d8f34f]">.</span>
      {nome.slice(i + 1)}
    </span>
  );
}

export function DocumentoRelatorio({
  r,
  comentario,
}: {
  r: NonNullable<Relatorio>;
  comentario?: string | null;
}) {
  const a = r.atual;
  const b = r.anterior.totais;
  const temGasto = a.investimento > 0;
  const temVenda = a.fechados > 0;

  return (
    <article className="documento-relatorio overflow-hidden rounded-2xl border border-borda bg-superficie">
      <header className="bg-[#141414] px-5 pb-9 pt-7 text-[#f6f4ef] sm:px-8">
        <p className="font-titulo text-lg font-bold">
          <Logo nome={r.agencia} />
        </p>
        <p className="mt-8 text-xs uppercase tracking-widest text-[#8a8a85]">
          Relatório de resultados
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">{r.cliente.nome}</h1>
        <p className="mt-2 text-[#d6d4cd]">
          {dataLonga(r.periodo.de)} a {dataLonga(r.periodo.ate)} · {r.periodo.dias}{" "}
          {r.periodo.dias === 1 ? "dia" : "dias"}
        </p>
        <div className="mt-5 h-1 w-14 bg-[#d8f34f]" />
      </header>

      <div className="px-5 py-7 sm:px-8">
        {comentario && (
          <Bloco titulo="Resumo do período">
            <p className="whitespace-pre-line leading-relaxed">{comentario}</p>
          </Bloco>
        )}

        <Bloco
          titulo="Números principais"
          nota={`Comparado a ${dataLonga(r.anterior.de)} – ${dataLonga(r.anterior.ate)}, período anterior de mesmo tamanho.`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Numero titulo="Investimento" valor={moeda(a.investimento)} agora={a.investimento} antes={b.investimento} neutro />
            <Numero titulo="Contatos recebidos" valor={inteiro(a.leads)} agora={a.leads} antes={b.leads} />
            <Numero titulo="Custo por contato" valor={moeda(a.cpl)} agora={a.cpl} antes={b.cpl} menorMelhor />
            <Numero titulo="Vendas fechadas" valor={inteiro(a.fechados)} agora={a.fechados} antes={b.fechados} />
            {a.receita > 0 ? (
              <Numero titulo="Faturamento das vendas" valor={moeda(a.receita)} agora={a.receita} antes={b.receita} />
            ) : (
              <Numero titulo="Taxa de fechamento" valor={pct(a.taxaFechamento)} agora={a.taxaFechamento} antes={b.taxaFechamento} />
            )}
            {a.roas != null ? (
              <Numero
                titulo="Retorno sobre investimento"
                valor={a.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "x"}
                agora={a.roas}
                antes={b.roas}
                nota="Cada R$ 1 investido voltou em vendas"
              />
            ) : (
              <Numero titulo="Custo por venda" valor={moeda(a.cac)} agora={a.cac} antes={b.cac} menorMelhor />
            )}
          </div>
        </Bloco>

        <Bloco titulo="Dia a dia">
          <GraficoDiario dias={r.porDia} mostrarGasto={temGasto} />
        </Bloco>

        <Bloco titulo="Do anúncio à venda">
          <Funil a={a} />
        </Bloco>

        {r.campanhas.length > 0 && (
          <Bloco titulo="Por campanha">
            <Tabela
              coluna="Campanha"
              linhas={r.campanhas}
              mostrarGasto={temGasto}
              mostrarVenda={temVenda}
            />
          </Bloco>
        )}

        {r.anuncios.length > 0 && (
          <Bloco titulo="Anúncios que mais trouxeram contatos">
            <Tabela coluna="Anúncio" linhas={r.anuncios} mostrarGasto={temGasto} mostrarVenda={temVenda} />
          </Bloco>
        )}

        {r.semAtribuicao > 0 && (r.campanhas.length > 0 || r.anuncios.length > 0) && (
          <p className="-mt-4 mb-8 text-sm text-suave">
            {r.semAtribuicao} {r.semAtribuicao === 1 ? "contato chegou" : "contatos chegaram"} sem
            anúncio identificado: entram nos números principais, não nas tabelas.
          </p>
        )}

        {r.interesses.length > 0 && (
          <Bloco titulo="O que as pessoas procuraram">
            <Barras
              itens={r.interesses.map((i) => ({ rotulo: i.rotulo, valor: i.leads }))}
            />
          </Bloco>
        )}

        {r.status.length > 0 && (
          <Bloco titulo="Onde estão os contatos do período">
            <Barras
              itens={ORDEM_STATUS.filter((s) => r.status.some((x) => x.status === s)).map((s) => ({
                rotulo: ROTULO_STATUS[s],
                valor: r.status.find((x) => x.status === s)!.leads,
              }))}
            />
          </Bloco>
        )}

        <footer className="mt-4 border-t border-borda pt-5 text-xs leading-relaxed text-suave">
          Contatos contam no dia em que chegaram, e vendas no período do contato que as gerou.
          Investimento, impressões e cliques vêm do Meta Ads. Relatório preparado por{" "}
          <span className="font-medium text-texto">{r.agencia}</span>.
        </footer>
      </div>
    </article>
  );
}

const ORDEM_STATUS = ["NOVO", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIANDO", "FECHADO", "PERDIDO"];

function Bloco({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9 break-inside-avoid">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-suave">{titulo}</h2>
      {nota && <p className="mt-1 text-xs text-suave">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Variação contra o período anterior, com a cor dizendo se foi bom. */
function Numero({
  titulo,
  valor,
  agora,
  antes,
  menorMelhor,
  neutro,
  nota,
}: {
  titulo: string;
  valor: string;
  agora: number | null;
  antes: number | null;
  menorMelhor?: boolean;
  neutro?: boolean;
  nota?: string;
}) {
  let variacao: React.ReactNode = <span className="text-suave">sem base anterior</span>;
  if (agora != null && antes != null && antes > 0) {
    const d = (agora - antes) / antes;
    if (Math.abs(d) < 0.005) {
      variacao = <span className="text-suave">igual ao anterior</span>;
    } else {
      const bom = neutro ? null : menorMelhor ? d < 0 : d > 0;
      const cor = bom == null ? "text-suave" : bom ? "text-ok" : "text-alerta";
      const texto = (d > 0 ? "+" : "−") + pct(Math.abs(d), 0);
      variacao = (
        <span className={cor}>
          {d > 0 ? "▲" : "▼"} {texto} <span className="text-suave">vs anterior</span>
        </span>
      );
    }
  }
  return (
    <div className="rounded-2xl border border-borda p-3.5">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 font-titulo text-lg font-bold sm:text-2xl">{valor}</p>
      <p className="mt-1 text-xs">{variacao}</p>
      {nota && <p className="mt-1 text-xs text-suave">{nota}</p>}
    </div>
  );
}

/**
 * Colunas de contatos por dia; a linha é o investimento do dia. O desenho
 * estica na largura da tela e as datas ficam fora dele, em texto normal, para
 * não virarem letra miúda no celular.
 */
function GraficoDiario({
  dias,
  mostrarGasto,
}: {
  dias: { dia: string; investimento: number; leads: number }[];
  mostrarGasto: boolean;
}) {
  const L = 600;
  const A = 160;
  const topo = 8;
  const maxLeads = Math.max(1, ...dias.map((d) => d.leads));
  const maxGasto = Math.max(1, ...dias.map((d) => d.investimento));
  const passo = L / dias.length;
  const larg = Math.max(1.5, Math.min(26, passo * 0.64));
  const y = (v: number, max: number) => A - ((A - topo) * v) / max;
  const pontos = dias.map((d, i) => `${(i + 0.5) * passo},${y(d.investimento, maxGasto)}`).join(" ");
  const marcas = Math.min(dias.length, 5);
  const indices = [...new Set(Array.from({ length: marcas }, (_, k) =>
    marcas === 1 ? 0 : Math.round((k * (dias.length - 1)) / (marcas - 1)),
  ))];

  return (
    <div>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Contatos e investimento por dia"
      >
        {dias.map((d, i) => (
          <rect
            key={d.dia}
            x={(i + 0.5) * passo - larg / 2}
            y={y(d.leads, maxLeads)}
            width={larg}
            height={A - y(d.leads, maxLeads)}
            fill="#b7ce2e"
          >
            <title>{`${dataCurta(d.dia)}: ${d.leads} contatos, ${moeda(d.investimento)}`}</title>
          </rect>
        ))}
        {mostrarGasto && (
          <polyline
            points={pontos}
            fill="none"
            stroke="var(--texto)"
            strokeWidth="1.8"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="relative h-5 border-t border-borda text-[11px] text-suave">
        {indices.map((i) => (
          <span
            key={i}
            className="absolute top-1 -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
            style={{ left: i === 0 ? 0 : i === dias.length - 1 ? "100%" : `${((i + 0.5) / dias.length) * 100}%` }}
          >
            {dataCurta(dias[i].dia)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#b7ce2e]" /> Contatos por dia
          (máx. {maxLeads})
        </span>
        {mostrarGasto && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-texto" /> Investimento por dia (máx.{" "}
            {moeda(maxGasto)})
          </span>
        )}
      </div>
    </div>
  );
}

function Funil({ a }: { a: Totais }) {
  const etapas = [
    { rotulo: "Pessoas alcançadas (impressões)", valor: a.impressoes },
    { rotulo: "Cliques no anúncio", valor: a.cliquesAnuncio },
    { rotulo: "Visitas na página", valor: a.visitas },
    { rotulo: "Contatos recebidos", valor: a.leads },
    { rotulo: "Vendas fechadas", valor: a.fechados },
  ].filter((e, i, todas) => e.valor > 0 || i >= todas.length - 2);

  // Raiz quadrada na largura: com escala linear, de 50 mil impressões para 30
  // contatos a barra dos contatos sumiria.
  const max = Math.sqrt(Math.max(1, ...etapas.map((e) => e.valor)));

  return (
    <ol className="flex flex-col gap-2">
      {etapas.map((e, i) => {
        const anterior = etapas[i - 1];
        const taxa = anterior && anterior.valor > 0 ? e.valor / anterior.valor : null;
        return (
          <li key={e.rotulo}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{e.rotulo}</span>
              <span className="font-semibold">{inteiro(e.valor)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-fundo">
              <div
                className="h-2.5 rounded-full bg-[#d8f34f]"
                style={{ width: `${Math.max(1.5, (Math.sqrt(e.valor) / max) * 100)}%` }}
              />
            </div>
            {taxa != null && (
              <p className="mt-0.5 text-right text-xs text-suave">{pct(taxa)} da etapa anterior</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Tabela({
  coluna,
  linhas,
  mostrarGasto,
  mostrarVenda,
}: {
  coluna: string;
  linhas: NonNullable<Relatorio>["campanhas"];
  mostrarGasto: boolean;
  mostrarVenda: boolean;
}) {
  const colunas = [
    mostrarGasto && { rotulo: "Investido", valor: (l: Linha) => moeda(l.gasto) },
    { rotulo: "Contatos", valor: (l: Linha) => inteiro(l.leads) },
    mostrarGasto && { rotulo: "Por contato", valor: (l: Linha) => moeda(l.cpl) },
    mostrarVenda && { rotulo: "Vendas", valor: (l: Linha) => inteiro(l.fechados) },
  ].filter(Boolean) as { rotulo: string; valor: (l: Linha) => string }[];

  return (
    <>
      {/* Celular: um cartão por linha, com o nome inteiro em cima. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {linhas.map((l) => (
          <li key={l.chave} className="rounded-2xl border border-borda p-3">
            <p className="text-sm font-medium [overflow-wrap:anywhere]">{l.rotulo}</p>
            <dl className={`mt-2 grid gap-2 ${colunas.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {colunas.map((c) => (
                <div key={c.rotulo}>
                  <dt className="text-[11px] text-suave">{c.rotulo}</dt>
                  <dd className="text-sm font-semibold">{c.valor(l)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-2xl border border-borda sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borda text-left text-xs text-suave">
              <th className="px-3 py-2 font-medium">{coluna}</th>
              {colunas.map((c) => (
                <th key={c.rotulo} className="px-3 py-2 text-right font-medium">
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave} className="border-b border-borda last:border-0">
                <td className="px-3 py-2 [overflow-wrap:anywhere]">{l.rotulo}</td>
                {colunas.map((c) => (
                  <td key={c.rotulo} className="whitespace-nowrap px-3 py-2 text-right">
                    {c.valor(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type Linha = NonNullable<Relatorio>["campanhas"][number];

function Barras({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="[overflow-wrap:anywhere]">{i.rotulo}</span>
            <span className="font-semibold">{i.valor}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-fundo">
            <div className="h-2 rounded-full bg-[#b7ce2e]" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
