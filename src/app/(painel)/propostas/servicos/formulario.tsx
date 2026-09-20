"use client";

import { useActionState } from "react";
import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { acaoCriarServico, type EstadoServico } from "./acoes";

const vazio: EstadoServico = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

export function NovoServico() {
  const [estado, criar, criando] = useActionState(acaoCriarServico, vazio);
  const chave = useLimparAoConcluir(estado);

  return (
    <Formulario
      key={chave}
      acao={criar}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
    >
      <p className="text-sm font-medium">Adicionar serviço</p>
      <input name="nome" required placeholder="Ex.: Consultoria de funil" className={campo} />
      <input
        name="detalhe"
        placeholder="Detalhe que aparece embaixo do nome (opcional)"
        className={campo}
      />
      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}
      {estado.ok && <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>}
      <button
        type="submit"
        disabled={criando}
        className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {criando ? "Salvando..." : "Adicionar"}
      </button>
    </Formulario>
  );
}
