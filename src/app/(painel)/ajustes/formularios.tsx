"use client";

import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { useActionState } from "react";
import {
  acaoCriarUsuario,
  acaoSalvarCredenciais,
  acaoTrocarFunil,
  acaoTrocarSenha,
  type EstadoAjustes,
} from "./acoes";
import { ROTULO_FUNIL } from "@/lib/regras";
import type { Papel } from "@prisma/client";

const vazio: EstadoAjustes = {};

const campo =
  "rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";
const botao = "rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60";

function Aviso({ estado }: { estado: EstadoAjustes }) {
  if (estado.erro) {
    return <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>;
  }
  if (estado.ok) {
    return <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>;
  }
  return null;
}

export function FormulariosAjustes({
  papel,
  clienteEmFoco,
  funilAtual,
  clientes,
}: {
  papel: Papel;
  clienteEmFoco: { id: string; nome: string } | null;
  funilAtual: string;
  clientes: { id: string; nome: string }[];
}) {
  const [estadoUsuario, criarUsuario, criandoUsuario] = useActionState(acaoCriarUsuario, vazio);
  const [estadoCred, salvarCred, salvandoCred] = useActionState(acaoSalvarCredenciais, vazio);
  const [estadoSenha, trocarSenha, trocandoSenha] = useActionState(acaoTrocarSenha, vazio);
  const [estadoFunil, trocarFunil, trocandoFunil] = useActionState(acaoTrocarFunil, vazio);
  // Senha e token não podem ficar na tela depois de salvos.
  const chaveSenha = useLimparAoConcluir(estadoSenha);
  const chaveUsuario = useLimparAoConcluir(estadoUsuario);
  const chaveCred = useLimparAoConcluir(estadoCred);

  return (
    <>
      {papel === "ADMIN" && (
        <p className="mt-6 rounded-2xl border border-dashed border-borda px-4 py-4 text-sm text-suave">
          Cliente novo se cadastra em{" "}
          <a href="/negocio/novo" className="text-marca-texto underline">
            Negócio → Novo cliente
          </a>
          , com fee, vencimento e contrato.
        </p>
      )}

      {papel === "ADMIN" && clienteEmFoco && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
            Credenciais do Meta — {clienteEmFoco.nome}
          </h2>
          <Formulario
            key={chaveCred}
            acao={salvarCred}
            className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
          >
            <input type="hidden" name="clienteId" value={clienteEmFoco.id} />
            <input name="pixelId" placeholder="ID do pixel" className={campo} />
            <input
              name="capiToken"
              type="password"
              placeholder="Token da API de Conversões"
              className={campo}
            />
            <input
              name="marketingToken"
              type="password"
              placeholder="Token da API de Marketing"
              className={campo}
            />
            <input name="contaAnunciosId" placeholder="act_000000000000000" className={campo} />
            <p className="text-xs text-suave">
              Campo em branco mantém o valor atual. Use token de usuário do sistema da BM da JL Ads.
            </p>
            <Aviso estado={estadoCred} />
            <button type="submit" disabled={salvandoCred} className={botao}>
              {salvandoCred ? "Salvando..." : "Salvar credenciais"}
            </button>
          </Formulario>
        </section>
      )}

      {papel !== "ATENDENTE" && clienteEmFoco && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
            Funil de {clienteEmFoco.nome}
          </h2>
          <Formulario
            acao={trocarFunil}
            className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
          >
            <input type="hidden" name="clienteId" value={clienteEmFoco.id} />
            <select name="funil" defaultValue={funilAtual} className={campo}>
              {Object.entries(ROTULO_FUNIL).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
            <p className="text-xs text-suave">
              Muda as etapas que o cliente vê na tela de confirmação e as colunas do pipeline.
              Clínica e psicóloga costumam usar o simples; filmmaker, obra e consultoria, o
              completo.
            </p>
            <Aviso estado={estadoFunil} />
            <button type="submit" disabled={trocandoFunil} className={botao}>
              {trocandoFunil ? "Salvando..." : "Salvar funil"}
            </button>
          </Formulario>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
          Minha senha
        </h2>
        <Formulario
          key={chaveSenha}
          acao={trocarSenha}
          className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
        >
          <input
            name="atual"
            type="password"
            autoComplete="current-password"
            placeholder="Senha atual"
            required
            className={campo}
          />
          <input
            name="nova"
            type="password"
            autoComplete="new-password"
            placeholder="Nova senha (mínimo 10 caracteres)"
            required
            className={campo}
          />
          <input
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            required
            className={campo}
          />
          <Aviso estado={estadoSenha} />
          <button type="submit" disabled={trocandoSenha} className={botao}>
            {trocandoSenha ? "Trocando..." : "Trocar senha"}
          </button>
        </Formulario>
      </section>

      {papel !== "ATENDENTE" && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
            Novo usuário
          </h2>
          <Formulario
            key={chaveUsuario}
            acao={criarUsuario}
            className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
          >
            <input name="nome" placeholder="Nome" required className={campo} />
            <input name="email" type="email" placeholder="E-mail" required className={campo} />
            <input
              name="senha"
              type="password"
              placeholder="Senha (mínimo 8 caracteres)"
              required
              className={campo}
            />
            <select name="papel" defaultValue="ATENDENTE" className={campo}>
              <option value="ATENDENTE">Atendente</option>
              <option value="GESTOR">Gestor</option>
              {papel === "ADMIN" && <option value="ADMIN">Administrador</option>}
            </select>
            <select
              name="clienteId"
              defaultValue={clienteEmFoco?.id ?? ""}
              className={campo}
              disabled={papel !== "ADMIN"}
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <Aviso estado={estadoUsuario} />
            <button type="submit" disabled={criandoUsuario} className={botao}>
              {criandoUsuario ? "Criando..." : "Criar usuário"}
            </button>
          </Formulario>
        </section>
      )}
    </>
  );
}
