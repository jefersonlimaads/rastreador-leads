import { exigirSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listarTarefas } from "@/lib/tarefas";
import { Vazio } from "../componentes";
import { FormularioTarefa, ItemTarefa } from "./itens";

/**
 * Tarefas da jl.ads e de todos os clientes numa lista só, ordenada por urgência.
 * Dentro do ambiente de um cliente, a mesma lista aparece filtrada.
 */
export default async function PaginaTarefas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await exigirSessao();
  const filtros = await searchParams;
  const escopo = typeof filtros.de === "string" ? filtros.de : "tudo";

  const clientes =
    sessao.papel === "ADMIN"
      ? await prisma.cliente.findMany({
          where: { ativo: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        })
      : [];

  // "jlads" = só as minhas; um id = só as daquele cliente; "tudo" = todas.
  const filtroCliente =
    escopo === "jlads" ? null : escopo === "tudo" ? undefined : escopo;

  const { atrasadas, hoje, proximas, semPrazo, feitas } = await listarTarefas({
    clienteId: sessao.papel === "ADMIN" ? filtroCliente : sessao.clienteId,
    incluirFeitas: true,
  });

  const abertas = atrasadas.length + hoje.length + proximas.length + semPrazo.length;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Tarefas</h1>
      <p className="mt-1 text-sm text-suave">
        {abertas === 0 ? "Nada em aberto." : `${abertas} em aberto`}
        {atrasadas.length > 0 ? ` · ${atrasadas.length} atrasada(s)` : ""}
      </p>

      {sessao.papel === "ADMIN" && clientes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Filtro atual={escopo} valor="tudo" rotulo="Tudo" />
          <Filtro atual={escopo} valor="jlads" rotulo="jl.ads" />
          {clientes.map((c) => (
            <Filtro key={c.id} atual={escopo} valor={c.id} rotulo={c.nome} />
          ))}
        </div>
      )}

      <FormularioTarefa
        clientes={clientes}
        clienteFixo={sessao.papel === "ADMIN" ? null : sessao.clienteId}
        escopo={escopo}
      />

      <Grupo titulo="Atrasadas" tarefas={atrasadas} alerta />
      <Grupo titulo="Para hoje" tarefas={hoje} />
      <Grupo titulo="Próximas" tarefas={proximas} />
      <Grupo titulo="Sem prazo" tarefas={semPrazo} />

      {abertas === 0 && <Vazio>Nenhuma tarefa em aberto. Anote a próxima acima.</Vazio>}

      {feitas.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-suave">
            Concluídas ({feitas.length})
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {feitas.slice(0, 30).map((t) => (
              <ItemTarefa key={t.id} tarefa={{ ...t, prazo: t.prazo?.toISOString() ?? null }} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function Filtro({ atual, valor, rotulo }: { atual: string; valor: string; rotulo: string }) {
  const ativo = atual === valor;
  return (
    <a
      href={`/tarefas?de=${valor}`}
      className={`rounded-xl border px-3 py-1.5 text-sm ${
        ativo ? "border-marca bg-marca-suave text-marca-texto" : "border-borda"
      }`}
    >
      {rotulo}
    </a>
  );
}

function Grupo({
  titulo,
  tarefas,
  alerta,
}: {
  titulo: string;
  tarefas: { id: string; titulo: string; descricao: string | null; prazo: Date | null; status: string; clienteNome: string | null }[];
  alerta?: boolean;
}) {
  if (tarefas.length === 0) return null;

  return (
    <section className="mt-6">
      <h2
        className={`mb-2 text-sm font-semibold uppercase tracking-wide ${
          alerta ? "text-alerta" : "text-suave"
        }`}
      >
        {titulo} <span className="text-xs font-normal">{tarefas.length}</span>
      </h2>
      <div className="flex flex-col gap-2">
        {tarefas.map((t) => (
          <ItemTarefa
            key={t.id}
            tarefa={{ ...t, prazo: t.prazo?.toISOString() ?? null }}
            alerta={alerta}
          />
        ))}
      </div>
    </section>
  );
}
