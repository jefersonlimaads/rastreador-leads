"use client";

import { useActionState, useState } from "react";
import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { TIPOS_DE_ENTREGA } from "@/lib/entregas";
import { acaoRegistrarEntrega, type EstadoNegocio } from "../acoes";

const vazio: EstadoNegocio = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

/** Registro rápido: o que foi entregue, em que mês. Aparece no relatório do cliente. */
export function NovaEntrega({ clienteId, competencia }: { clienteId: string; competencia: string }) {
  const [estado, registrar, registrando] = useActionState(acaoRegistrarEntrega, vazio);
  const chave = useLimparAoConcluir(estado);
  const [aberto, setAberto] = useState(false);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setAberto(false);
  }

  if (!aberto) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {estado.ok && <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-xl border border-dashed border-borda px-4 py-2.5 text-left text-sm text-suave hover:border-marca hover:text-texto"
        >
          + Registrar entrega
        </button>
      </div>
    );
  }

  return (
    <Formulario key={chave} acao={registrar} className="mt-2 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <select name="tipo" defaultValue="Criativo" className={campo}>
          {TIPOS_DE_ENTREGA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input name="descricao" required autoFocus placeholder="3 reels gravados para a campanha de implante" className={campo} />
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-suave">Mês</span>
        <input type="month" name="competencia" defaultValue={competencia} className={campo} />
      </label>
      {estado.erro && <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={registrando}
          className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
        >
          {registrando ? "Salvando..." : "Registrar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-borda px-4 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </Formulario>
  );
}
