import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { montarRelatorio, periodoDoRelatorio, registrarVisualizacaoRelatorio, relatorioPorToken } from "@/lib/relatorio";
import { DocumentoRelatorio } from "../documento";
import { BotaoImprimir } from "../imprimir";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rel = await relatorioPorToken(token);
  const periodo = rel ? await periodoDoRelatorio(rel) : null;
  const r = rel && periodo ? await montarRelatorio(rel.clienteId, periodo.de, periodo.ate) : null;
  return {
    title: r ? `Relatório — ${r.cliente.nome}` : "Relatório",
    description: r ? `Resultados de ${r.periodo.de.split("-").reverse().join("/")} a ${r.periodo.ate.split("-").reverse().join("/")}` : undefined,
    // Números do negócio do cliente: fora de busca.
    robots: { index: false, follow: false },
  };
}

/**
 * O relatório no link que vai para o cliente. Sem senha: quem tem o link vê
 * este período deste cliente e nada mais. Apagar o relatório no painel derruba
 * o link.
 */
export default async function PaginaRelatorioPublico({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const rel = await relatorioPorToken(token);
  if (!rel) notFound();
  const periodo = await periodoDoRelatorio(rel);
  const r = await montarRelatorio(rel.clienteId, periodo.de, periodo.ate);
  if (!r) notFound();

  // Você conferindo não conta como o cliente abrindo.
  if (!(await sessaoAtual())) await registrarVisualizacaoRelatorio(rel.id);

  return (
    <main className="min-h-dvh bg-fundo px-3 py-5 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <DocumentoRelatorio r={r} comentario={rel.comentario} />
        <div className="nao-imprimir mt-5 flex justify-center">
          <BotaoImprimir className="rounded-xl bg-marca px-5 py-2.5 text-sm font-medium text-sobre-marca" />
        </div>
      </div>
    </main>
  );
}
