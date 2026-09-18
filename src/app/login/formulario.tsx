"use client";

import { Formulario } from "@/app/formulario";
import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = {};

export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState(entrar, estadoInicial);

  return (
    <Formulario acao={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-xl border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-marca"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Senha</span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-xl border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-marca"
        />
      </label>

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-xl bg-marca px-4 py-3 font-medium text-sobre-marca disabled:opacity-60"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </Formulario>
  );
}
