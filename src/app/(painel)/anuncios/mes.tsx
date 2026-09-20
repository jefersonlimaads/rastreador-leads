import Link from "next/link";
import type { RitmoDoMes } from "@/lib/metas";
import { formatarEspera, type TempoDeResposta } from "@/lib/atendimento";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Como o mês está indo e quanto tempo o lead espera para ser atendido. Duas
 * leituras que não cabem no recorte de 7 ou 30 dias das outras seções: a meta
 * é sempre do mês corrente, e a espera é do atendimento, não da mídia.
 */
export function MesEAtendimento({
  ritmo,
  atendimento,
  clienteId,
}: {
  ritmo: RitmoDoMes | null;
  atendimento: TempoDeResposta;
  clienteId: string;
}) {
  const semMeta = !ritmo?.orcamento && !ritmo?.metaContatos;

  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Mês até agora</h2>
        {ritmo ? (
          <>
            <p className="mt-2 text-sm">
              Dia {ritmo.diasCorridos} de {ritmo.diasNoMes} · {moeda(ritmo.gasto)} investidos ·{" "}
              {ritmo.contatos} contatos
              {ritmo.cpl != null ? ` · ${moeda(ritmo.cpl)} por contato` : ""}
            </p>

            {ritmo.orcamento != null && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between text-xs text-suave">
                  <span>
                    {moeda(ritmo.gasto)} de {moeda(ritmo.orcamento)}
                  </span>
                  <span>{Math.round((ritmo.usado ?? 0) * 100)}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-fundo">
                  <div
                    className={`h-2 rounded-full ${ritmo.ritmo === "acima" ? "bg-alerta" : "bg-marca"}`}
                    style={{ width: `${Math.min(100, Math.round((ritmo.usado ?? 0) * 100))}%` }}
                  />
                </div>
                <p className={`mt-2 text-sm ${ritmo.ritmo === "acima" ? "text-alerta" : ""}`}>
                  {ritmo.ritmo === "acima"
                    ? `No ritmo de hoje, o mês fecha em ${moeda(ritmo.projecaoGasto)}: acima do orçamento.`
                    : ritmo.ritmo === "abaixo"
                      ? `No ritmo de hoje, o mês fecha em ${moeda(ritmo.projecaoGasto)}: vai sobrar orçamento.`
                      : `No ritmo de hoje, o mês fecha em ${moeda(ritmo.projecaoGasto)}, dentro do combinado.`}
                </p>
              </div>
            )}

            {ritmo.metaContatos != null && (
              <p className="mt-2 text-sm">
                {ritmo.contatos} de {ritmo.metaContatos} contatos · projeção de {ritmo.projecaoContatos}
                {ritmo.projecaoContatos >= ritmo.metaContatos ? " (bate a meta)" : " (abaixo da meta)"}
              </p>
            )}

            {ritmo.metaCpl != null && ritmo.cpl != null && (
              <p className="mt-1 text-sm">
                Custo por contato {moeda(ritmo.cpl)} contra meta de {moeda(ritmo.metaCpl)}
                {ritmo.cpl <= ritmo.metaCpl ? " — dentro" : " — acima"}
              </p>
            )}

            {semMeta && (
              <p className="mt-2 text-xs text-suave">
                Sem orçamento nem meta cadastrados.{" "}
                <Link href={`/ajustes?cliente=${clienteId}`} className="text-marca-texto underline">
                  Cadastrar em Ajustes
                </Link>
                .
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-suave">Sem dados do mês ainda.</p>
        )}
      </div>

      <div className="rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Tempo de resposta</h2>
        {atendimento.leads === 0 ? (
          <p className="mt-2 text-sm text-suave">Nenhum contato no período.</p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              Espera típica até o primeiro contato: <strong>{formatarEspera(atendimento.medianaMin)}</strong>
              {atendimento.semResposta > 0 && (
                <span className="text-alerta"> · {atendimento.semResposta} sem resposta</span>
              )}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {atendimento.faixas
                .filter((f) => f.leads > 0)
                .map((f) => (
                  <li key={f.rotulo} className="flex items-baseline justify-between gap-3">
                    <span className="text-suave">{f.rotulo}</span>
                    <span>
                      {f.leads} {f.leads === 1 ? "contato" : "contatos"}
                      {f.taxa != null && f.fechados > 0 ? ` · ${pct(f.taxa)} fecharam` : ""}
                    </span>
                  </li>
                ))}
            </ul>
            {atendimento.comparacao && <p className="mt-3 text-sm">{atendimento.comparacao}</p>}
          </>
        )}
      </div>
    </section>
  );
}
