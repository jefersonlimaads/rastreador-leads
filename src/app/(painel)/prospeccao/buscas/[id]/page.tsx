import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Selo, Vazio, tempoRelativo } from "../../../componentes";
import { acaoPromoverDiagnostico } from "../../acoes";

/**
 * Resultado de uma busca: quem entrou em A abordar e quem ficou de fora, com a
 * nota e o motivo. Discordou de um descarte? "Adicionar mesmo assim".
 */
export default async function PaginaBusca({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirAdmin();
  const { id } = await params;
  const busca = await prisma.buscaProspeccao.findFirst({
    where: { id, agenciaId: sessao.agenciaId },
    include: { diagnosticos: { orderBy: [{ pontuacao: { sort: "desc", nulls: "last" } }, { nome: "asc" }] } },
  });
  if (!busca) notFound();

  const entraram = busca.diagnosticos.filter((d) => d.clienteId);
  const fora = busca.diagnosticos.filter((d) => !d.clienteId && d.status === "DESCARTADO");
  const outros = busca.diagnosticos.filter((d) => !d.clienteId && d.status !== "DESCARTADO");

  return (
    <>
      <Link href="/prospeccao" className="text-sm text-suave">
        ← Prospecção
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        {busca.nicho} · {busca.cidade}
      </h1>
      <p className="mt-1 text-sm text-suave">
        {busca.encontrados} empresas · {entraram.length} em A abordar · nota mínima {busca.notaMinima} ·{" "}
        {tempoRelativo(busca.criadoEm)}
      </p>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-suave">
        Em A abordar <span className="text-xs font-normal">{entraram.length}</span>
      </h2>
      {entraram.length === 0 ? (
        <Vazio>Nenhuma empresa passou da nota mínima.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {entraram.map((d) => (
            <li key={d.id}>
              <Link
                href={`/prospeccao/${d.clienteId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-3 py-2.5 hover:border-suave"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.nome}</p>
                  <p className="truncate text-xs text-suave">{d.resumo ?? d.endereco}</p>
                </div>
                <Nota valor={d.pontuacao} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {fora.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-suave">
            Ficaram de fora <span className="text-xs font-normal">{fora.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {fora.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nome}</p>
                  <p className="text-xs text-suave">{d.resumo ?? d.endereco}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Nota valor={d.pontuacao} />
                  <form action={acaoPromoverDiagnostico}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="rounded-lg border border-borda px-2.5 py-1 text-xs">
                      Adicionar mesmo assim
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {outros.length > 0 && (
        <p className="mt-6 text-sm text-suave">
          {outros.filter((d) => d.status === "ERRO").length > 0 &&
            `${outros.filter((d) => d.status === "ERRO").length} com erro na análise. `}
          {outros.filter((d) => d.status !== "ERRO").length > 0 &&
            `${outros.filter((d) => d.status !== "ERRO").length} ainda na fila.`}
        </p>
      )}
    </>
  );
}

function Nota({ valor }: { valor: number | null }) {
  if (valor == null) return <Selo>—</Selo>;
  return <Selo tom={valor >= 70 ? "marca" : valor >= 50 ? "neutro" : "alerta"}>{valor}</Selo>;
}
