import Link from "next/link";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { metricasPorAnuncio, type Nivel } from "@/lib/metricas";
import { dataPuraDe, formatarData, formatarDataHora, periodoPadrao } from "@/lib/datas";
import { campanhasDoMeta } from "@/lib/relatorio";
import { ResultadosCampanhas } from "@/app/relatorio/documento";
import { prisma } from "@/lib/prisma";
import { moeda, Selo, Vazio } from "../componentes";

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

  const [{ linhas, total, semAtribuicao }, doMeta] = await Promise.all([
    metricasPorAnuncio({ clienteId, de, ate, nivel, fuso }),
    campanhasDoMeta(clienteId, dataPuraDe(de, fuso), dataPuraDe(ate, fuso)),
  ]);

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

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador titulo="Leads" valor={String(total.leads)} nota={`${total.leadsExatos} exatos`} />
        <Indicador titulo="Fechados" valor={String(total.fechados)} />
        <Indicador titulo="Gasto" valor={moeda(total.gasto)} />
        <Indicador
          titulo="ROAS"
          valor={total.roas != null ? total.roas.toFixed(2) + "x" : "—"}
          nota={moeda(total.receita)}
        />
      </section>

      {doMeta.campanhas.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
            Resultado de cada campanha (Meta)
          </h2>
          <ResultadosCampanhas campanhas={doMeta.campanhas} />
        </section>
      )}

      {semAtribuicao > 0 && (
        <p className="mt-3 text-sm text-suave">
          {semAtribuicao} {semAtribuicao === 1 ? "lead" : "leads"} sem anúncio identificado. Entram
          no total do cliente, não nas linhas abaixo.
        </p>
      )}

      <section className="mt-5">
        {linhas.length === 0 ? (
          <Vazio>
            Nenhum lead atribuído no período. Se já houve cliques, confira se o script está
            instalado na landing page.
          </Vazio>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-suave">
                  <th className="px-3 py-2.5">{NIVEIS.find((n) => n.valor === nivel)?.rotulo}</th>
                  <th className="px-3 py-2.5 text-right">Leads</th>
                  <th className="px-3 py-2.5 text-right">Gasto</th>
                  <th className="px-3 py-2.5 text-right">CPL</th>
                  <th className="px-3 py-2.5 text-right">CAC</th>
                  <th className="px-3 py-2.5 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.chave} className="border-b border-borda last:border-0">
                    <td className="px-3 py-2.5">
                      <Link href={`/leads?ad=${l.chave}`} className="font-medium">
                        {l.rotulo}
                      </Link>
                      <div className="mt-1 flex gap-1">
                        <Selo>{l.fechados} fechados</Selo>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{l.leads}</td>
                    <td className="px-3 py-2.5 text-right">{moeda(l.gasto)}</td>
                    <td className="px-3 py-2.5 text-right">{l.cpl != null ? moeda(l.cpl) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{l.cac != null ? moeda(l.cac) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      {l.roas != null ? l.roas.toFixed(2) + "x" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
