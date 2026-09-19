"use client";

import { Formulario } from "@/app/formulario";
import { useActionState, useState } from "react";
import { acaoNovoProspect, type EstadoProspeccao } from "./acoes";

const vazio: EstadoProspeccao = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

/** Cadastro rápido: o resto se completa na ficha do prospect. */
export function NovoProspect({ origens }: { origens: string[] }) {
  const [estado, criar, criando] = useActionState(acaoNovoProspect, vazio);
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 w-full rounded-xl border border-dashed border-borda px-4 py-2.5 text-left text-sm text-suave hover:border-marca hover:text-texto"
      >
        + Novo prospect
      </button>
    );
  }

  return (
    <Formulario acao={criar} className="mt-4 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <input name="nome" required autoFocus placeholder="Nome da empresa ou da pessoa" className={campo} />
      <div className="grid grid-cols-2 gap-3">
        <input name="nicho" placeholder="Nicho (clínica, filmmaker...)" className={campo} />
        <select name="origem" defaultValue="" className={campo}>
          <option value="">De onde veio</option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <input name="contatoTelefone" type="tel" inputMode="tel" placeholder="WhatsApp (opcional)" className={campo} />
      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={criando}
          className="flex-1 rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
        >
          {criando ? "Criando..." : "Cadastrar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-borda px-4 py-2.5 text-sm">
          Fechar
        </button>
      </div>
    </Formulario>
  );
}
