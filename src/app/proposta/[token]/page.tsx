import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import {
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
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposta = await propostaPublica(token);
  if (!proposta || proposta.status === "RASCUNHO") notFound();

  // Você abrindo para conferir não conta como o lead abrindo.
  const sessao = await sessaoAtual();
  if (!sessao) await registrarVisualizacao(proposta.id);

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
        {proposta.apresentacao && (
          <section>
            <p className="whitespace-pre-line text-lg leading-relaxed">{proposta.apresentacao}</p>
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
            <div className="mt-4 rounded-2xl border border-borda bg-superficie p-5">
              {fee && (
                <>
                  {descontoFee && (
                    <p className="text-suave">
                      De <span className="line-through">{moeda(feeCheio!)}</span> por mês
                    </p>
                  )}
                  <p className={descontoFee ? "mt-1" : undefined}>
                    <span className="font-titulo text-3xl font-bold">{moeda(fee)}</span>
                    <span className="text-suave"> por mês</span>
                  </p>
                </>
              )}

              {setup && (
                <p className="mt-2 text-suave">
                  + {moeda(setup)} de implantação, uma vez
                  {descontoSetup && (
                    <span> (de <span className="line-through">{moeda(setupCheio!)}</span>)</span>
                  )}
                </p>
              )}

              {proposta.meses && (
                <p className="mt-2 text-suave">Contrato de {rotuloPeriodo(proposta.meses)}</p>
              )}

              {descontoFee && (
                <p className="mt-4 rounded-xl bg-[#d8f34f] px-3 py-2 text-sm font-medium text-[#141414]">
                  Você economiza {moeda(descontoFee.valor)} por mês
                  {noPeriodo ? ` — ${moeda(noPeriodo)} no período do contrato` : ""}
                  {" "}({Math.round(descontoFee.pct * 100)}% de desconto)
                </p>
              )}
            </div>
          </section>
        )}

        {proposta.condicoes && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-suave">
              Condições
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-suave">
              {proposta.condicoes}
            </p>
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
