import { notFound } from "next/navigation";
import { clientePorToken, pendencias } from "@/lib/confirmacao";
import { formatarDataHora } from "@/lib/datas";
import { formatarTelefone } from "@/lib/telefone";
import { ETAPAS_DO_FUNIL } from "@/lib/regras";
import { ItemClique, ItemLead } from "./itens";

export const dynamic = "force-dynamic";

/**
 * Página que o cliente abre pelo link, sem senha. Duas perguntas, em lote:
 * quem falou com você, e no que deu. Pensada para ser respondida em pé, no
 * celular, no fim do expediente.
 */
export default async function PaginaConfirmar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cliente = await clientePorToken(token);
  if (!cliente) notFound();

  const { cliques, leads } = await pendencias(cliente.id);
  const total = cliques.length + leads.length;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{cliente.nome}</h1>
        <p className="mt-1 text-sm text-suave">
          {total === 0
            ? "Nada pendente por aqui. Pode fechar."
            : `${total} ${total === 1 ? "item para responder" : "itens para responder"}. Leva menos de um minuto.`}
        </p>
      </header>

      {cliques.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-suave">
            Essas pessoas clicaram no anúncio
          </h2>
          <p className="mb-3 text-sm text-suave">
            Alguma delas te mandou mensagem no WhatsApp? O código aparece no fim da primeira
            mensagem que a pessoa envia.
          </p>
          <div className="flex flex-col gap-3">
            {cliques.map((c) => (
              <ItemClique
                key={c.id}
                token={token}
                cliqueId={c.id}
                codigo={c.codigo}
                interesse={c.interesse}
                nome={c.nomeVisitante}
                telefone={c.telefoneVisitante ? formatarTelefone(c.telefoneVisitante) : null}
                quando={formatarDataHora(c.criadoEm, cliente.fuso)}
              />
            ))}
          </div>
        </section>
      )}

      {leads.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-suave">
            Essas conversas ainda estão em aberto
          </h2>
          <p className="mb-3 text-sm text-suave">No que deu cada uma?</p>
          <div className="flex flex-col gap-3">
            {leads.map((l) => (
              <ItemLead
                key={l.id}
                token={token}
                leadId={l.id}
                titulo={l.nome || l.clique?.nomeVisitante || l.clique?.interesse || "Conversa sem nome"}
                telefone={
                  l.telefone
                    ? formatarTelefone(l.telefone)
                    : l.clique?.telefoneVisitante
                      ? formatarTelefone(l.clique.telefoneVisitante)
                      : null
                }
                interesse={l.clique?.interesse ?? null}
                etapaAtual={l.status}
                etapas={[...ETAPAS_DO_FUNIL[cliente.funil]]}
                codigo={l.clique?.codigo ?? null}
                quando={formatarDataHora(l.criadoEm, cliente.fuso)}
              />
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-borda px-4 py-8 text-center text-sm text-suave">
          Tudo respondido. Obrigado.
        </p>
      )}

      <footer className="mt-10 text-center text-xs text-suave">
        Rastreamento de leads · JL Ads
      </footer>
    </main>
  );
}
