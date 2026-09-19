import Link from "next/link";
import type { AlertaCampanha, Recomendacao } from "@/lib/inteligencia";
import { RESULTADO, type TipoResultado } from "@/lib/resultados";

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
