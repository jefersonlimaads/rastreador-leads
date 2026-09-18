import { exigirPlataforma } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatarDataPura } from "@/lib/datas";
import { Selo } from "../componentes";
import { NovaAgencia } from "./formulario";
import { acaoAlternarAgencia } from "./acoes";

/**
 * Plataforma: onde o dono do produto cria agências. Mostra números de uso, não
 * dados das agências — daqui não se abre cliente, lead ou fatura de ninguém.
 */
export default async function PaginaPlataforma() {
  const sessao = await exigirPlataforma();

  const agencias = await prisma.agencia.findMany({
    orderBy: { criadoEm: "asc" },
    include: { _count: { select: { clientes: true, usuarios: true } } },
  });

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Plataforma</h1>
      <p className="mt-1 text-sm text-suave">
        {agencias.length} {agencias.length === 1 ? "agência" : "agências"} ·{" "}
        {agencias.filter((a) => a.ativa).length} ativas
      </p>

      <NovaAgencia />

      <section className="mt-6 flex flex-col gap-2">
        {agencias.map((a) => (
          <article
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {a.nome}
                {a.id === sessao.agenciaId ? " (sua)" : ""}
              </p>
              <p className="text-xs text-suave">
                {a._count.clientes} clientes · {a._count.usuarios} usuários · desde{" "}
                {formatarDataPura(new Date(Date.UTC(a.criadoEm.getUTCFullYear(), a.criadoEm.getUTCMonth(), a.criadoEm.getUTCDate())))}
              </p>
            </div>
            {a.id === sessao.agenciaId ? (
              <Selo tom="ok">ativa</Selo>
            ) : (
              <form action={acaoAlternarAgencia}>
                <input type="hidden" name="agenciaId" value={a.id} />
                <button
                  type="submit"
                  className={`rounded-xl border px-3 py-1.5 text-xs ${
                    a.ativa ? "border-borda" : "border-alerta text-alerta"
                  }`}
                >
                  {a.ativa ? "Desativar" : "Reativar"}
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
