import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { visaoGeral } from "@/lib/visaoGeral";
import { formatarDataHora } from "@/lib/datas";
import { moeda, Selo, Vazio } from "../componentes";
import { AbrirCliente } from "./abrir-cliente";

/**
 * Carteira: todos os clientes numa tela só, para quem gere tráfego de vários.
 * É a tela de abertura do administrador — as outras telas são sempre de um
 * cliente por vez.
 */
export default async function PaginaCarteira({ searchParams }: PageProps<"/carteira">) {
  await exigirAdmin();
  const filtros = await searchParams;
  const dias = Number(filtros.dias ?? 7) || 7;

  const linhas = await visaoGeral(dias);

  const totais = linhas.reduce(
    (acc, l) => ({
      leadsHoje: acc.leadsHoje + l.leadsHoje,
      leads: acc.leads + l.leadsPeriodo,
      gasto: acc.gasto + l.gasto,
      receita: acc.receita + l.receita,
      pendencias: acc.pendencias + l.semResposta + l.followUp,
    }),
    { leadsHoje: 0, leads: 0, gasto: 0, receita: 0, pendencias: 0 },
  );

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Carteira</h1>
      <p className="mt-1 text-sm text-suave">
        {linhas.length} {linhas.length === 1 ? "cliente ativo" : "clientes ativos"} · últimos {dias}{" "}
        dias
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/carteira?dias=${d}`}
            className={`rounded-xl border px-3 py-2 text-sm ${
              dias === d ? "border-marca bg-marca-suave text-marca" : "border-borda"
            }`}
          >
            {d} dias
          </Link>
        ))}
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador titulo="Leads hoje" valor={String(totais.leadsHoje)} />
        <Indicador titulo={`Leads em ${dias}d`} valor={String(totais.leads)} />
        <Indicador titulo="Gasto" valor={moeda(totais.gasto)} />
        <Indicador
          titulo="Precisam de você"
          valor={String(totais.pendencias)}
          alerta={totais.pendencias > 0}
        />
      </section>

      <section className="mt-5 flex flex-col gap-3">
        {linhas.length === 0 && <Vazio>Nenhum cliente ativo. Cadastre em Ajustes.</Vazio>}

        {linhas.map((l) => (
          <article key={l.id} className="rounded-2xl border border-borda bg-superficie p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{l.nome}</h2>
                <p className="mt-0.5 text-sm text-suave">
                  {l.leadsHoje} {l.leadsHoje === 1 ? "lead hoje" : "leads hoje"} · {l.leadsPeriodo}{" "}
                  em {dias} dias · {l.fechadosPeriodo} fechados
                </p>
              </div>
              <AbrirCliente clienteId={l.id} />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-suave">Gasto</dt>
                <dd className="mt-0.5 font-medium">{moeda(l.gasto)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-suave">CPL</dt>
                <dd className="mt-0.5 font-medium">{l.cpl != null ? moeda(l.cpl) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-suave">CAC</dt>
                <dd className="mt-0.5 font-medium">{l.cac != null ? moeda(l.cac) : "—"}</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              {l.semResposta > 0 && <Selo tom="alerta">{l.semResposta} sem resposta</Selo>}
              {l.followUp > 0 && <Selo tom="alerta">{l.followUp} em follow-up</Selo>}
              {l.cliquesPendentes > 0 && (
                <Selo>{l.cliquesPendentes} cliques aguardando mensagem</Selo>
              )}
              {l.roas != null && <Selo tom="ok">ROAS {l.roas.toFixed(2)}x</Selo>}
              {!l.temCredenciaisMeta && <Selo tom="alerta">sem credenciais do Meta</Selo>}
              {l.semResposta === 0 && l.followUp === 0 && <Selo tom="ok">fila em dia</Selo>}
            </div>

            {l.gasto === 0 && (
              <p className="mt-3 text-xs text-suave">
                {l.gastoSincronizadoEm
                  ? `Sem gasto no período. Última sincronização em ${formatarDataHora(l.gastoSincronizadoEm, l.fuso)}.`
                  : "Gasto nunca sincronizado: falta o token da API de Marketing em Ajustes."}
              </p>
            )}
          </article>
        ))}
      </section>
    </>
  );
}

function Indicador({
  titulo,
  valor,
  alerta,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        alerta ? "border-alerta bg-alerta-suave" : "border-borda bg-superficie"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-suave">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold ${alerta ? "text-alerta" : ""}`}>{valor}</p>
    </div>
  );
}
