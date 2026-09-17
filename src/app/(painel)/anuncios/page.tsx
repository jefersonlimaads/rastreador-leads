import Link from "next/link";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { metricasPorAnuncio, periodoPadrao, type Nivel } from "@/lib/metricas";
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
  const { de, ate } = periodoPadrao(dias);

  const { linhas, total, semAtribuicao } = await metricasPorAnuncio({ clienteId, de, ate, nivel });

  const ultimaSync = await prisma.gasto.findFirst({
    where: { clienteId },
    orderBy: { atualizadoEm: "desc" },
    select: { atualizadoEm: true },
  });

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Anúncios</h1>
      <p className="mt-1 text-sm text-suave">
        {de.toLocaleDateString("pt-BR")} a {ate.toLocaleDateString("pt-BR")}
        {ultimaSync
          ? ` · gasto sincronizado ${ultimaSync.atualizadoEm.toLocaleString("pt-BR")}`
          : " · gasto ainda não sincronizado"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/anuncios?dias=${d}&nivel=${nivel}`}
            className={`rounded-xl border px-3 py-2 text-sm ${
              dias === d ? "border-marca bg-marca-suave text-marca" : "border-borda"
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
              nivel === n.valor ? "border-marca bg-marca-suave text-marca" : "border-borda"
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
