import Link from "next/link";
import type { RitmoDoMes } from "@/lib/metas";
import { formatarEspera, type TempoDeResposta } from "@/lib/atendimento";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Como o mês está indo, em uma faixa só.
 *
 * Antes era um cartão com três parágrafos, disputando espaço com o resto da
 * tela. É a primeira pergunta de quem abre ("o mês vai fechar bem?"), então
 * vem em cima, curta, e sai da frente.
 */
export function FaixaDoMes({ ritmo }: { ritmo: RitmoDoMes | null }) {
  if (!ritmo) return null;

  const semMeta = ritmo.orcamento == null && ritmo.metaContatos == null;
  if (semMeta) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-borda px-4 py-3 text-sm text-suave">
        Dia {ritmo.diasCorridos} de {ritmo.diasNoMes} · {moeda(ritmo.gasto)} investidos no mês.{" "}
        <Link href="/ajustes" className="text-marca-texto">
          Defina orçamento e meta
        </Link>{" "}
        para acompanhar o ritmo.
      </p>
    );
  }

  const acima = ritmo.ritmo === "acima";
  const usado = Math.min(100, Math.round((ritmo.usado ?? 0) * 100));
  const bateMeta =
    ritmo.metaContatos != null ? ritmo.projecaoContatos >= ritmo.metaContatos : null;

  return (
    <section
      className={`mt-4 rounded-2xl border p-4 ${acima ? "border-alerta bg-alerta-suave" : "border-borda bg-superficie"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          Mês até agora · dia {ritmo.diasCorridos} de {ritmo.diasNoMes}
        </h2>
        {ritmo.orcamento != null && (
          <p className="text-sm text-suave">
            {moeda(ritmo.gasto)} de {moeda(ritmo.orcamento)} ({usado}%)
          </p>
        )}
      </div>

      {ritmo.orcamento != null && (
        <div className="mt-2 h-2 rounded-full bg-fundo">
          <div
            className={`h-2 rounded-full ${acima ? "bg-alerta" : "bg-marca"}`}
            style={{ width: `${usado}%` }}
          />
        </div>
      )}

      {/* As três leituras numa linha: verba, volume e preço. */}
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {ritmo.orcamento != null && (
          <div>
            <dt className="text-xs text-suave">Fecha o mês em</dt>
            <dd className={`text-sm font-medium ${acima ? "text-alerta" : ""}`}>
              {moeda(ritmo.projecaoGasto)}
              <span className="font-normal text-suave">
                {acima ? " · acima" : ritmo.ritmo === "abaixo" ? " · vai sobrar" : " · no combinado"}
              </span>
            </dd>
          </div>
        )}
        {ritmo.metaContatos != null && (
          <div>
            <dt className="text-xs text-suave">Contatos</dt>
            <dd className="text-sm font-medium">
              {ritmo.contatos} de {ritmo.metaContatos}
              <span className="font-normal text-suave">
                {" · "}projeção {ritmo.projecaoContatos}
                {bateMeta ? "" : ", abaixo"}
              </span>
            </dd>
          </div>
        )}
        {ritmo.cpl != null && (
          <div>
            <dt className="text-xs text-suave">Custo por contato</dt>
            <dd className="text-sm font-medium">
              {moeda(ritmo.cpl)}
              {ritmo.metaCpl != null && (
                <span className="font-normal text-suave">
                  {" · meta "}
                  {moeda(ritmo.metaCpl)}
                  {ritmo.cpl <= ritmo.metaCpl ? "" : ", acima"}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** Amostra menor que isso não sustenta uma mediana que se apresente ao cliente. */
const MINIMO_CONFIAVEL = 5;

/**
 * Tempo de resposta. Fica no detalhe, e não no topo, porque mede o atendimento
 * do cliente, não a mídia — e some quando poucos leads foram tocados, para não
 * anunciar "menos de 1 min" calculado sobre dois contatos.
 */
export function TempoDeRespostaBloco({
  atendimento,
  clienteId,
}: {
  atendimento: TempoDeResposta;
  clienteId: string;
}) {
  if (atendimento.leads === 0) return null;

  const poucos = atendimento.respondidos < MINIMO_CONFIAVEL;

  return (
    <div className="flex flex-col gap-2">
      {poucos ? (
        <p className="text-sm text-suave">
          {atendimento.respondidos === 0
            ? "Nenhum contato tem atendimento registrado no período."
            : `Só ${atendimento.respondidos} de ${atendimento.leads} contatos têm atendimento registrado: pouco para uma média.`}{" "}
          O tempo é medido pelo registro no painel, não pela resposta no WhatsApp.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Espera típica até o primeiro registro:{" "}
            <strong>{formatarEspera(atendimento.medianaMin)}</strong>
            {atendimento.semResposta > 0 && (
              <span className="text-suave"> · {atendimento.semResposta} sem registro</span>
            )}
          </p>
          <dl className="flex flex-col gap-1">
            {atendimento.faixas
              .filter((f) => f.leads > 0)
              .map((f) => (
                <div key={f.rotulo} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-suave">{f.rotulo}</dt>
                  <dd>
                    {f.leads} {f.leads === 1 ? "contato" : "contatos"}
                    {f.taxa != null && <span className="text-suave"> · {pct(f.taxa)} fecharam</span>}
                  </dd>
                </div>
              ))}
          </dl>
          {atendimento.comparacao && <p className="text-sm">{atendimento.comparacao}</p>}
        </>
      )}
      <Link href={`/leads?cliente=${clienteId}`} className="text-sm text-marca-texto">
        Ver os contatos
      </Link>
    </div>
  );
}
