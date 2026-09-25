import Link from "next/link";
import type { DiagnosticoFunil, EtapaFunil } from "@/lib/funil-anuncio";
import type { AnuncioPeriodo } from "@/lib/inteligencia";

const inteiro = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const COR: Record<EtapaFunil["estado"], string> = {
  bom: "text-ok",
  ok: "text-texto",
  ruim: "text-alerta",
  sem_referencia: "text-suave",
  sem_volume: "text-suave",
};

/**
 * O caminho do anúncio, etapa por etapa.
 *
 * Cada passagem quebra por um motivo diferente — criativo, oferta da página,
 * atendimento. Ver a taxa de cada uma é o que separa "o anúncio não performa"
 * de "o problema é a página".
 *
 * Não há etapa de visita: o script mede a intenção de contato, não o
 * carregamento. Quem quiser visitas tem o número no Gerenciador.
 */
export function Funil({ funil }: { funil: DiagnosticoFunil }) {
  return (
    <ol className="flex flex-col gap-2">
      {funil.etapas.map((e) => {
        const destaque = funil.gargalo?.chave === e.chave;
        return (
          <li
            key={e.chave}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-xl px-3 py-2 ${
              destaque ? "bg-alerta-suave" : "bg-fundo"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{e.rotulo}</p>
              <p className="text-xs text-suave">{e.mede}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{inteiro(e.valor)}</p>
              {e.taxa != null && (
                <p className={`text-xs tabular-nums ${COR[e.estado]}`}>
                  {pct(e.taxa)}
                  {e.estado === "sem_volume" && " · pouco volume"}
                  {e.referencia && e.estado !== "sem_volume" && (
                    <span className="text-suave">
                      {" "}
                      (mín. {pct(e.referencia.ruim)})
                    </span>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Os anúncios cujo caminho está quebrando, do que mais gasta para o que menos
 * gasta. É a leitura que diz onde mexer — e o dinheiro parado no gargalo é o
 * que decide a ordem.
 */
export function Gargalos({
  gargalos,
}: {
  gargalos: { anuncio: AnuncioPeriodo; funil: DiagnosticoFunil }[];
}) {
  if (gargalos.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          Onde o caminho está quebrando
        </h2>
        <p className="text-xs text-suave">
          Da impressão à venda, etapa por etapa. Os mais caros primeiro.
        </p>
      </div>

      <ul className="mt-2 flex flex-col gap-3">
        {gargalos.map(({ anuncio, funil }) => (
          <li key={anuncio.adId} className="rounded-2xl border border-borda bg-superficie p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{anuncio.nome}</p>
              {anuncio.campanha && <span className="text-xs text-suave">{anuncio.campanha}</span>}
            </div>

            <p className="mt-2 text-sm font-medium text-alerta">{funil.gargalo!.titulo}</p>
            <p className="mt-0.5 text-sm text-suave">
              Com {anuncio.gasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{" "}
              investidos, {funil.gargalo!.motivo}
            </p>
            <p className="mt-1.5 text-sm">{funil.gargalo!.acao}</p>

            <div className="mt-3 border-t border-borda pt-3">
              <Funil funil={funil} />
            </div>

            <Link
              href={`/leads?ad=${anuncio.adId}`}
              className="mt-2 inline-block text-sm text-marca-texto"
            >
              Ver os contatos deste anúncio
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
