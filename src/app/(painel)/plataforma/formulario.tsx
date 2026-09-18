"use client";

import { useActionState } from "react";
import { acaoCriarAgencia, type EstadoPlataforma } from "./acoes";

const vazio: EstadoPlataforma = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

export function NovaAgencia() {
  const [estado, criar, criando] = useActionState(acaoCriarAgencia, vazio);

  return (
    <form action={criar} className="mt-5 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Nova agência</h2>
      <input name="nome" required placeholder="Nome da agência" className={campo} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="adminNome" required placeholder="Nome do administrador" className={campo} />
        <input name="adminEmail" type="email" required placeholder="E-mail do administrador" className={campo} />
      </div>

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      {/* A senha aparece uma vez só: ela não fica guardada em lugar nenhum. */}
      {estado.senha && (
        <div className="rounded-xl border border-marca bg-marca-suave p-3 text-sm">
          <p className="font-medium text-marca-texto">{estado.ok}</p>
          <p className="mt-2">
            Acesso: <strong>{estado.email}</strong>
            <br />
            Senha temporária: <strong className="font-mono">{estado.senha}</strong>
          </p>
          <p className="mt-2 text-xs text-suave">
            Copie agora: ela não aparece de novo. O administrador troca em Ajustes no primeiro acesso.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={criando}
        className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {criando ? "Criando..." : "Criar agência"}
      </button>
    </form>
  );
}
