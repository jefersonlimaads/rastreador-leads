"use client";

import { useActionState, useState } from "react";
import {
  acaoAlternarTarefa,
  acaoApagarTarefa,
  acaoCriarTarefa,
  type EstadoTarefa,
} from "./acoes";

const vazio: EstadoTarefa = {};

const campo =
  "rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

/** Prazo é data pura: formatar em UTC evita o dia andar para trás. */
function formatarPrazo(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export function ItemTarefa({
  tarefa,
  alerta,
}: {
  tarefa: {
    id: string;
    titulo: string;
    descricao: string | null;
    prazo: string | null;
    status: string;
    clienteNome: string | null;
  };
  alerta?: boolean;
}) {
  const feita = tarefa.status === "FEITA";

  return (
    <article
      className={`flex items-start gap-3 rounded-xl border bg-superficie px-3 py-2.5 ${
        alerta ? "border-alerta" : "border-borda"
      } ${feita ? "opacity-60" : ""}`}
    >
      <form action={acaoAlternarTarefa} className="pt-0.5">
        <input type="hidden" name="tarefaId" value={tarefa.id} />
        <button
          type="submit"
          aria-label={feita ? "Reabrir tarefa" : "Concluir tarefa"}
          className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs ${
            feita ? "border-marca bg-marca text-sobre-marca" : "border-borda"
          }`}
        >
          {feita ? "✓" : ""}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${feita ? "line-through" : ""}`}>{tarefa.titulo}</p>
        {tarefa.descricao && <p className="mt-0.5 text-sm text-suave">{tarefa.descricao}</p>}
        <p className="mt-1 text-xs text-suave">
          {[tarefa.clienteNome ?? "jl.ads", tarefa.prazo ? formatarPrazo(tarefa.prazo) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <form action={acaoApagarTarefa}>
        <input type="hidden" name="tarefaId" value={tarefa.id} />
        <button type="submit" aria-label="Apagar tarefa" className="px-1 text-sm text-suave">
          ×
        </button>
      </form>
    </article>
  );
}

export function FormularioTarefa({
  clientes,
  clienteFixo,
  escopo,
}: {
  clientes: { id: string; nome: string }[];
  clienteFixo: string | null;
  escopo: string;
}) {
  const [estado, criar, criando] = useActionState(acaoCriarTarefa, vazio);
  const [aberto, setAberto] = useState(false);

  // No filtro de um cliente, a tarefa já nasce dele; em "jl.ads", nasce sem dono.
  const clientePadrao =
    clienteFixo ?? (escopo !== "tudo" && escopo !== "jlads" ? escopo : "");

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 w-full rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca"
      >
        Nova tarefa
      </button>
    );
  }

  return (
    <form
      action={criar}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
    >
      <input name="titulo" placeholder="O que precisa ser feito" required autoFocus className={campo} />
      <input name="descricao" placeholder="Detalhe (opcional)" className={campo} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-suave">Prazo</span>
          <input name="prazo" type="date" className={campo} />
        </label>

        {clienteFixo ? (
          <input type="hidden" name="clienteId" value={clienteFixo} />
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-suave">De quem é</span>
            <select name="clienteId" defaultValue={clientePadrao} className={campo}>
              <option value="">jl.ads</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={criando}
          className="flex-1 rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
        >
          {criando ? "Salvando..." : "Anotar"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-xl border border-borda px-4 py-2.5 text-sm"
        >
          Fechar
        </button>
      </div>
    </form>
  );
}
