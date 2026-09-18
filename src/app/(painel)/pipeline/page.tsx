import Link from "next/link";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { pipeline } from "@/lib/consultas";
import { ROTULO_STATUS } from "@/lib/regras";
import { formatarTelefone } from "@/lib/telefone";
import { Selo, moeda, tempoRelativo } from "../componentes";

const ORDEM = ["NOVO", "EM_ATENDIMENTO", "ORCAMENTO_ENVIADO", "FECHADO", "PERDIDO"] as const;

export default async function PaginaPipeline({ searchParams }: PageProps<"/pipeline">) {
  const { cliente } = await searchParams;
  const { sessao, clienteId } = await exigirCliente(typeof cliente === "string" ? cliente : null);
  const colunas = await pipeline(clienteId);
  const mostrarValor = podeVerDinheiro(sessao.papel);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
      <p className="mt-1 text-sm text-suave">Toque no lead para mudar o status.</p>

      {/* No celular as colunas viram uma fita horizontal; no desktop ficam lado a lado. */}
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
        {ORDEM.map((status) => {
          const leads = colunas[status] ?? [];
          return (
            <section
              key={status}
              className="w-[78vw] max-w-xs shrink-0 snap-start rounded-2xl border border-borda bg-superficie p-3 sm:w-64"
            >
              <header className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{ROTULO_STATUS[status]}</h2>
                <span className="text-xs text-suave">{leads.length}</span>
              </header>

              <div className="mt-3 flex flex-col gap-2">
                {leads.length === 0 && <p className="text-xs text-suave">Vazio</p>}
                {leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="rounded-xl border border-borda px-3 py-2.5"
                  >
                    <p className="truncate text-sm font-medium">
                      {lead.nome || (lead.telefone ? formatarTelefone(lead.telefone) : "Sem telefone")}
                    </p>
                    <p className="mt-0.5 text-xs text-suave">{tempoRelativo(lead.criadoEm)}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lead.anuncio && <Selo>{lead.anuncio}</Selo>}
                      {mostrarValor && lead.valorVenda != null && (
                        <Selo tom="ok">{moeda(lead.valorVenda)}</Selo>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
