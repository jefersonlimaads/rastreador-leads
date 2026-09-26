import type { DiaDaSerie } from "@/lib/evolucao";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (v: number) => v.toLocaleString("pt-BR");

/**
 * Evolução dia a dia.
 *
 * Dois gráficos alinhados, não um com dois eixos: investimento é dinheiro e
 * contato é contagem, e forçar os dois na mesma escala faz qualquer relação
 * parecer verdadeira. Alinhados pelo mesmo dia, a comparação continua possível
 * e nenhuma proporção é inventada.
 *
 * Responde "quando mudou?", que total nenhum responde: um custo médio de R$ 6
 * pode ser seis dias a R$ 4 e um dia a R$ 18 — e é esse dia que tem explicação.
 */
export function Evolucao({ serie }: { serie: DiaDaSerie[] }) {
  if (serie.length < 2) return null;

  const totalInvestido = serie.reduce((s, d) => s + d.investimento, 0);
  const totalContatos = serie.reduce((s, d) => s + d.contatos, 0);
  if (totalInvestido === 0 && totalContatos === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          Evolução dia a dia
        </h2>
        <p className="text-xs text-suave">
          {/* A taxa do período sai dos totais, nunca da média das diárias: um dia
              de R$ 5 não pode pesar igual a um de R$ 500. */}
          {totalContatos > 0 && totalInvestido > 0
            ? `${moeda(totalInvestido / totalContatos)} por contato no período`
            : `${serie.length} dias`}
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <Barras
          serie={serie}
          titulo="Investimento"
          total={moeda(totalInvestido)}
          valorDe={(d) => d.investimento}
          formatar={moeda}
        />
        <Barras
          serie={serie}
          titulo="Contatos"
          total={inteiro(totalContatos)}
          valorDe={(d) => d.contatos}
          formatar={inteiro}
        />
      </div>
    </section>
  );
}

function Barras({
  serie,
  titulo,
  total,
  valorDe,
  formatar,
}: {
  serie: DiaDaSerie[];
  titulo: string;
  total: string;
  valorDe: (d: DiaDaSerie) => number;
  formatar: (v: number) => string;
}) {
  const valores = serie.map(valorDe);
  const maximo = Math.max(...valores);
  const indiceMaior = valores.indexOf(maximo);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-suave">{titulo}</p>
        <p className="text-sm font-semibold tabular-nums">{total}</p>
      </div>

      {/* Uma coluna por dia, inclusive os vazios: buraco na série esconderia o
          dia em que a campanha ficou fora do ar. */}
      <div className="mt-1.5 flex h-16 items-end gap-[2px]">
        {serie.map((d, i) => {
          const v = valorDe(d);
          const altura = maximo > 0 ? Math.max(v > 0 ? 3 : 1, (v / maximo) * 100) : 1;
          return (
            /* O detalhe vem no atributo title: tooltip nativo do navegador,
               sem script. Como elemento, <title> só existe dentro de SVG. */
            <div
              key={d.dia}
              title={`${d.rotulo}: ${formatar(v)}`}
              className="flex-1 rounded-t"
              style={{
                height: `${altura}%`,
                backgroundColor: v > 0 ? "#d8f34f" : "var(--cor-borda, #33332f)",
                opacity: i === indiceMaior ? 1 : v > 0 ? 0.75 : 1,
              }}
            />
          );
        })}
      </div>

      {/* Só três marcas de data: uma por coluna colidiria em qualquer largura. */}
      <div className="mt-1 flex justify-between text-[11px] text-suave">
        <span>{serie[0].rotulo}</span>
        {serie.length > 6 && <span>{serie[Math.floor(serie.length / 2)].rotulo}</span>}
        <span>{serie[serie.length - 1].rotulo}</span>
      </div>
    </div>
  );
}
