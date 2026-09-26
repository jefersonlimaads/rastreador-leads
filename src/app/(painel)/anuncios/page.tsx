import Link from "next/link";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { metricasPorAnuncio, type Nivel } from "@/lib/metricas";
import { dataPuraDe, formatarData, formatarDataHora, periodoPadrao } from "@/lib/datas";
import { campanhasDoMeta } from "@/lib/relatorio";
import { inteligenciaDoCliente } from "@/lib/campanhas";
import { Comparacao, Diario, Inteligencia, TabelaAnuncios } from "./inteligencia";
import { Gargalos, Qualificacao } from "./funil";
import { leituraDaPerda, qualificacaoDoCliente } from "@/lib/qualificacao";
import { diarioDoCliente } from "@/lib/diario";
import { compararComACarteira } from "@/lib/benchmark";
import { FaixaDoMes, TempoDeRespostaBloco } from "./mes";
import { ritmoDoMes } from "@/lib/metas";
import { tempoDeResposta } from "@/lib/atendimento";
import { ResultadosCampanhas } from "@/app/relatorio/documento";
import { prisma } from "@/lib/prisma";
import { moeda, Vazio } from "../componentes";

const NIVEIS: { valor: Nivel; rotulo: string }[] = [
  { valor: "ad", rotulo: "Anúncio" },
  { valor: "adset", rotulo: "Conjunto" },
  { valor: "campaign", rotulo: "Campanha" },
];

export default async function PaginaAnuncios({ searchParams }: PageProps<"/anuncios">) {
  const filtros = await searchParams;
  const { sessao, clienteId } = await exigirCliente(
    typeof filtros.cliente === "string" ? filtros.cliente : null,
  );

  if (!podeVerDinheiro(sessao.papel)) {
    return <Vazio>Esta tela é para gestor e administrador.</Vazio>;
  }

  const dias = Number(filtros.dias ?? 30) || 30;
  const nivel = (typeof filtros.nivel === "string" ? filtros.nivel : "ad") as Nivel;
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { fuso: true },
  });
  const fuso = cliente?.fuso;
  const { de, ate } = periodoPadrao(dias, fuso);

  const [
    { linhas, total, semAtribuicao },
    doMeta,
    inteligencia,
    ritmo,
    atendimento,
    diario,
    comparacao,
    qualificacao,
  ] =
    await Promise.all([
      metricasPorAnuncio({ clienteId, de, ate, nivel, fuso }),
      campanhasDoMeta(clienteId, dataPuraDe(de, fuso), dataPuraDe(ate, fuso)),
      inteligenciaDoCliente(clienteId, dataPuraDe(de, fuso), dataPuraDe(ate, fuso), fuso),
      ritmoDoMes(clienteId),
      tempoDeResposta(clienteId, de, ate),
      diarioDoCliente(clienteId, fuso),
      compararComACarteira(clienteId, dataPuraDe(de, fuso), dataPuraDe(ate, fuso)),
      qualificacaoDoCliente(clienteId, de, ate),
    ]);

  /* O diagnóstico de cada anúncio vira selo na linha da tabela, em vez de
     cartão próprio: "vendendo" não é ação, é estado. */
  const diagnostico = new Map(inteligencia.recomendacoes.map((r) => [r.adId, r.categoria]));

  const ultimaSync = await prisma.gasto.findFirst({
    where: { clienteId },
    orderBy: { atualizadoEm: "desc" },
    select: { atualizadoEm: true },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Anúncios</h1>
        <Link
          href="/relatorios"
          className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca"
        >
          Gerar relatório
        </Link>
      </div>
      <p className="mt-1 text-sm text-suave">
        {formatarData(de, fuso)} a {formatarData(ate, fuso)}
        {ultimaSync
          ? ` · gasto sincronizado ${formatarDataHora(ultimaSync.atualizadoEm, fuso)}`
          : " · gasto ainda não sincronizado"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/anuncios?dias=${d}&nivel=${nivel}`}
            className={`rounded-xl border px-3 py-2 text-sm ${
              dias === d ? "border-marca bg-marca-suave text-marca-texto" : "border-borda"
            }`}
          >
            {d} dias
          </Link>
        ))}
        <span className="mx-1 w-px bg-borda" />
        {NIVEIS.map((n) => (
          <Link
            key={n.valor}
            href={`/anuncios?dias=${dias}&nivel=${n.valor}`}
            className={`rounded-xl border px-3 py-2 text-sm ${
              nivel === n.valor ? "border-marca bg-marca-suave text-marca-texto" : "border-borda"
            }`}
          >
            {n.rotulo}
          </Link>
        ))}
      </div>

      <FaixaDoMes ritmo={ritmo} />

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador titulo="Contatos" valor={String(total.leads)} nota={`${total.leadsExatos} exatos`} />
        <Indicador titulo="Vendas" valor={String(total.fechados)} />
        <Indicador titulo="Investido" valor={moeda(total.gasto)} />
        <Indicador
          titulo="Retorno"
          valor={total.roas != null ? total.roas.toFixed(1) + "x" : "—"}
          nota={moeda(total.receita)}
        />
      </section>

      <Inteligencia
        recomendacoes={inteligencia.recomendacoes}
        alertas={inteligencia.alertas}
        custoMediano={inteligencia.custoMediano}
        tipoMediano={inteligencia.tipoMediano}
        dias={inteligencia.dias}
      />

      <Qualificacao q={qualificacao} leitura={leituraDaPerda(qualificacao)} />

      <Gargalos gargalos={inteligencia.gargalos} />

      {linhas.length === 0 ? (
        <div className="mt-6">
          <Vazio>
            Nenhum contato atribuído no período. Se já houve cliques, confira se o script está
            instalado na landing page.
          </Vazio>
        </div>
      ) : (
        <TabelaAnuncios
          linhas={linhas}
          diagnostico={diagnostico}
          rotuloNivel={NIVEIS.find((n) => n.valor === nivel)?.rotulo ?? "Anúncio"}
          vendas={inteligencia.vendas}
        />
      )}

      {semAtribuicao > 0 && (
        <p className="mt-3 text-sm text-suave">
          {semAtribuicao} {semAtribuicao === 1 ? "contato" : "contatos"} sem anúncio identificado.
          Entram no total do cliente, não nas linhas acima.
        </p>
      )}

      {/* Detalhe: material de apoio, aberto por quem quiser. Fora do caminho de
          quem abriu a tela para decidir o que mexer hoje. */}
      <section className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Detalhe</h2>

        {comparacao && <Comparacao b={comparacao} />}

        <Detalhe titulo="Tempo de resposta" resumo="Quanto o contato espera para ser atendido">
          <TempoDeRespostaBloco atendimento={atendimento} clienteId={clienteId} />
        </Detalhe>

        {doMeta.campanhas.length > 0 && (
          <Detalhe titulo="Resultado de cada campanha" resumo="Como o Meta conta, por objetivo">
            <ResultadosCampanhas campanhas={doMeta.campanhas} />
          </Detalhe>
        )}

        {diario.length > 0 && (
          <Detalhe titulo="Diário de otimização" resumo="O que foi mexido e o que veio depois">
            <Diario mudancas={diario} />
          </Detalhe>
        )}
      </section>

    </>
  );
}

function Indicador({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-3">
      <p className="text-xs uppercase tracking-wide text-suave">{titulo}</p>
      <p className="mt-1 text-lg font-semibold">{valor}</p>
      {nota && <p className="text-xs text-suave">{nota}</p>}
    </div>
  );
}

/** Seção recolhida: o conteúdo existe, mas não ocupa a tela de quem vem decidir. */
function Detalhe({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-borda bg-superficie">
      <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-3 text-sm">
        <span className="font-medium">{titulo}</span>
        <span className="text-xs text-suave group-open:hidden">{resumo}</span>
        <span className="hidden text-xs text-suave group-open:inline">fechar</span>
      </summary>
      <div className="border-t border-borda px-4 py-4">{children}</div>
    </details>
  );
}
