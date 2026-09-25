import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { ehRobo } from "@/lib/robo";
import {
  blocosDeTexto,
  desconto,
  economiaDoPeriodo,
  lerEscopo,
  propostaPublica,
  registrarVisualizacao,
  rotuloPeriodo,
  situacao,
} from "@/lib/propostas";
import { formatarDataPura } from "@/lib/datas";
import { Resposta } from "./resposta";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await propostaPublica(token);
  return {
    title: p ? `Proposta para ${p.cliente.nome} — jl.ads` : "jl.ads",
    description: p?.titulo ?? "Proposta comercial",
    // Documento comercial com preço: não deve aparecer em busca.
    robots: { index: false, follow: false },
  };
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * A proposta como o lead vê. É um documento de venda: a abertura prova que foi
 * escrita para ele, o escopo diz o que ele recebe, o investimento vem depois do
 * valor, e a resposta fica no fim, a um toque.
 */
export default async function PaginaPropostaPublica({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const { previa } = await searchParams;
  const proposta = await propostaPublica(token);
  if (!proposta) notFound();

  /*
   * Rascunho só abre em prévia. Sem isso, a única forma de conferir como a
   * proposta chega era clicar em "gerar link para enviar" — que marca como
   * enviada e move o prospect no pipeline. Quem quis olhar acabou mandando.
   *
   * O segredo continua sendo o token: ?previa=1 sozinho não descobre nada.
   */
  const rascunho = proposta.status === "RASCUNHO";
  if (rascunho && !previa) notFound();

  /*
   * "Aberta" é sinal de venda: é o que faz você ligar. Três coisas não contam
   * como o lead abrindo — você logado no painel, a prévia com ?previa=1 (para
   * conferir do celular), e robô. O robô é o caso que mais engana: colar o
   * link no WhatsApp faz o próprio WhatsApp buscar a página para montar o
   * cartão de prévia, antes de qualquer pessoa tocar nele.
   */
  const sessao = await sessaoAtual();
  const robo = ehRobo((await headers()).get("user-agent"));
  if (!sessao && !previa && !robo) await registrarVisualizacao(proposta.id);

  const agora = situacao(proposta);
  const escopo = lerEscopo(proposta.escopo);
  const fee = proposta.feeMensal ? Number(proposta.feeMensal) : null;
  const feeCheio = proposta.feeCheio ? Number(proposta.feeCheio) : null;
  const setup = proposta.setup ? Number(proposta.setup) : null;
  const setupCheio = proposta.setupCheio ? Number(proposta.setupCheio) : null;
  const descontoFee = desconto(feeCheio, fee);
  const descontoSetup = desconto(setupCheio, setup);
  const noPeriodo = economiaDoPeriodo(feeCheio, fee, proposta.meses);

  return (
    <main className="min-h-dvh bg-fundo">
      {/* Capa em grafite, como a capa do guia da marca. */}
      <section className="bg-[#141414] px-5 pb-12 pt-8 text-[#f6f4ef]">
        <div className="mx-auto max-w-2xl">
          <p className="font-titulo text-lg font-bold">
            jl<span className="text-[#d8f34f]">.</span>ads
          </p>
          <p className="mt-10 text-sm uppercase tracking-widest text-[#8a8a85]">
            Proposta para {proposta.cliente.nome}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{proposta.titulo}</h1>
          <div className="mt-6 h-1 w-16 bg-[#d8f34f]" />
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-5 py-10">
        {rascunho && (
          <p className="mb-8 rounded-2xl border border-alerta bg-alerta-suave px-4 py-3 text-sm text-alerta">
            Rascunho: só quem tem este link está vendo. O cliente ainda não recebeu nada.
          </p>
        )}

        {proposta.apresentacao && (
          <section className="flex flex-col gap-4">
            <Texto bruto={proposta.apresentacao} tamanho="grande" />
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-suave">
            O que está incluído
          </h2>
          <ol className="mt-4 flex flex-col gap-3">
            {escopo.map((item, i) => (
              <li key={i} className="flex gap-4 rounded-2xl border border-borda bg-superficie p-4">
                <span className="font-titulo text-sm font-bold text-suave">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium">{item.titulo}</p>
                  {item.detalhe && <p className="mt-1 text-sm text-suave">{item.detalhe}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {(fee || setup) && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-suave">
              Investimento
            </h2>
            <PainelInvestimento
              fee={fee}
              feeCheio={feeCheio}
              setup={setup}
              setupCheio={setupCheio}
              meses={proposta.meses}
            />
          </section>
        )}

        {proposta.condicoes && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-suave">
              Condições
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <Texto bruto={proposta.condicoes} />
            </div>
          </section>
        )}

        <section className="mt-12">
          <Resposta
            token={token}
            situacao={agora}
            validade={formatarDataPura(proposta.validade)}
            aceitaPor={proposta.aceitaPor}
            contato={proposta.cliente.contatoNome}
          />
        </section>

        <footer className="mt-16 border-t border-borda pt-6 text-center text-xs text-suave">
          jeferson lima<span className="text-marca-texto">.</span> · tráfego pago & marketing
          criativo
        </footer>
      </div>
    </main>
  );
}

/** Texto do campo livre, em blocos: lista vira lista, parágrafo vira parágrafo. */
function Texto({ bruto, tamanho }: { bruto: string; tamanho?: "grande" }) {
  const grande = tamanho === "grande";
  return (
    <>
      {blocosDeTexto(bruto).map((b, i) =>
        b.tipo === "paragrafo" ? (
          <p key={i} className={grande ? "text-lg leading-relaxed" : "leading-relaxed"}>
            {b.texto}
          </p>
        ) : (
          <ul key={i} className="flex flex-col gap-2">
            {b.itens.map((item, j) => (
              <li key={j} className="flex gap-3 leading-relaxed">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[#d8f34f]" />
                <span className="[overflow-wrap:anywhere]">{item}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

/**
 * O preço é a informação que o cliente procura primeiro e a que ele repete
 * para o sócio depois. Por isso vem em cartão escuro, no tamanho maior da
 * página inteira.
 *
 * Qual número é o principal depende do que foi vendido: com mensalidade, ela
 * manda e a implantação é linha de apoio; sem mensalidade — projeto fechado —
 * o valor único é que manda, e antes ele aparecia em cinza pequeno.
 */
function PainelInvestimento({
  fee,
  feeCheio,
  setup,
  setupCheio,
  meses,
}: {
  fee: number | null;
  feeCheio: number | null;
  setup: number | null;
  setupCheio: number | null;
  meses: number | null;
}) {
  const recorrente = fee != null;
  const principal = recorrente ? fee : setup!;
  const cheio = recorrente ? feeCheio : setupCheio;
  const sufixo = recorrente ? "por mês" : "pagamento único";
  const abatimento = desconto(cheio, principal);
  const noPeriodo = recorrente ? economiaDoPeriodo(feeCheio, fee, meses) : null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-borda">
      <div className="bg-[#141414] px-5 py-7 text-[#f6f4ef] sm:px-7">
        {abatimento && (
          <p className="text-sm text-[#8a8a85]">
            De <span className="line-through">{moeda(cheio!)}</span>
            {/* "De X por mês" completa a frase; "De X pagamento único" repete
                o que já vem escrito embaixo do valor. */}
            {recorrente ? " por mês" : ""}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-titulo text-4xl font-bold tracking-tight sm:text-5xl">
            {moeda(principal)}
          </span>
          <span className="text-[#8a8a85]">{sufixo}</span>
        </p>

        {abatimento && (
          <p className="mt-4 inline-block rounded-xl bg-[#d8f34f] px-3.5 py-2 text-sm font-semibold text-[#141414]">
            Você economiza {moeda(abatimento.valor)}
            {recorrente ? " por mês" : ""}
            {noPeriodo ? ` — ${moeda(noPeriodo)} no contrato` : ""} ({Math.round(abatimento.pct * 100)}%)
          </p>
        )}
      </div>

      {(meses || (recorrente && setup != null)) && (
        <dl className="flex flex-col gap-2.5 bg-superficie px-5 py-4 sm:px-7">
          {recorrente && setup != null && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-sm text-suave">Implantação, uma vez</dt>
              <dd className="font-medium">
                {moeda(setup)}
                {desconto(setupCheio, setup) && (
                  <span className="ml-2 text-sm font-normal text-suave">
                    de <span className="line-through">{moeda(setupCheio!)}</span>
                  </span>
                )}
              </dd>
            </div>
          )}
          {meses && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-sm text-suave">Contrato</dt>
              <dd className="font-medium">{rotuloPeriodo(meses)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
