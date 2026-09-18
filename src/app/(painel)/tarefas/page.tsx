import { exigirSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listarTarefas } from "@/lib/tarefas";
import { Vazio } from "../componentes";
import { FormularioTarefa, ItemTarefa } from "./itens";
import { AgendaMes, AgendaSemana } from "./agenda";
import {
  agendaDaSemana,
  agendaDoMes,
  chaveDoDia,
  dataPuraDaChave,
  inicioDaSemana,
} from "@/lib/agenda";
import { hojeComoDataPura } from "@/lib/datas";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function somarDias(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function somarMeses(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

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
  const modo = filtros.modo === "semana" || filtros.modo === "mes" ? filtros.modo : "lista";
  const dataRef =
    typeof filtros.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filtros.data)
      ? dataPuraDaChave(filtros.data)
      : hojeComoDataPura();

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

  const alternador = <AlternarModo modo={modo} data={chaveDoDia(dataRef)} />;

  if (modo === "semana") {
    const { dias, segunda } = await agendaDaSemana(dataRef);
    const domingo = somarDias(segunda, 6);
    const titulo =
      segunda.getUTCMonth() === domingo.getUTCMonth()
        ? `${segunda.getUTCDate()} a ${domingo.getUTCDate()} de ${MESES[domingo.getUTCMonth()]}`
        : `${segunda.getUTCDate()} de ${MESES[segunda.getUTCMonth()]} a ${domingo.getUTCDate()} de ${MESES[domingo.getUTCMonth()]}`;
    return (
      <>
        {alternador}
        <Navegar
          titulo={titulo}
          anterior={`/tarefas?modo=semana&data=${chaveDoDia(somarDias(segunda, -7))}`}
          proximo={`/tarefas?modo=semana&data=${chaveDoDia(somarDias(segunda, 7))}`}
          hoje={`/tarefas?modo=semana&data=${chaveDoDia(inicioDaSemana(hojeComoDataPura()))}`}
        />
        <AgendaSemana dias={dias} />
        <Legenda />
      </>
    );
  }

  if (modo === "mes") {
    const { dias, primeiro } = await agendaDoMes(dataRef);
    return (
      <>
        {alternador}
        <Navegar
          titulo={`${MESES[primeiro.getUTCMonth()].replace(/^./, (l) => l.toUpperCase())} de ${primeiro.getUTCFullYear()}`}
          anterior={`/tarefas?modo=mes&data=${chaveDoDia(somarMeses(primeiro, -1))}`}
          proximo={`/tarefas?modo=mes&data=${chaveDoDia(somarMeses(primeiro, 1))}`}
          hoje={`/tarefas?modo=mes&data=${chaveDoDia(hojeComoDataPura())}`}
        />
        <AgendaMes dias={dias} />
        <Legenda />
      </>
    );
  }

  return (
    <>
      {alternador}
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Tarefas</h1>
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

function AlternarModo({ modo, data }: { modo: string; data: string }) {
  const opcoes = [
    { valor: "lista", rotulo: "Lista" },
    { valor: "semana", rotulo: "Semana" },
    { valor: "mes", rotulo: "Mês" },
  ];
  return (
    <div className="flex rounded-xl border border-borda bg-superficie p-1">
      {opcoes.map((o) => (
        <a
          key={o.valor}
          href={`/tarefas?modo=${o.valor}&data=${data}`}
          className={`flex-1 rounded-lg py-1.5 text-center text-sm ${
            modo === o.valor ? "bg-marca font-medium text-sobre-marca" : "text-suave"
          }`}
        >
          {o.rotulo}
        </a>
      ))}
    </div>
  );
}

function Navegar({
  titulo,
  anterior,
  proximo,
  hoje,
}: {
  titulo: string;
  anterior: string;
  proximo: string;
  hoje: string;
}) {
  return (
    <div className="my-4 flex items-center justify-between gap-2">
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
      <div className="flex shrink-0 gap-1">
        <a href={anterior} aria-label="Anterior" className="rounded-lg border border-borda px-3 py-1.5 text-sm">
          ‹
        </a>
        <a href={hoje} className="rounded-lg border border-borda px-3 py-1.5 text-sm">
          Hoje
        </a>
        <a href={proximo} aria-label="Próximo" className="rounded-lg border border-borda px-3 py-1.5 text-sm">
          ›
        </a>
      </div>
    </div>
  );
}

function Legenda() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-suave">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-marca" /> com horário
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-marca-suave" /> automática, dia inteiro
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-[#141414]" /> sua, dia inteiro
      </span>
    </p>
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
