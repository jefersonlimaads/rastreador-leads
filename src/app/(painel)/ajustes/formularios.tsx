"use client";

import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { useActionState, useState } from "react";
import {
  acaoCriarUsuario,
  acaoSalvarCredenciais,
  acaoSalvarNumero,
  acaoSincronizarMeta,
  acaoTrocarFunil,
  acaoTrocarSenha,
  type EstadoAjustes,
} from "./acoes";
import { ROTULO_FUNIL } from "@/lib/regras";
import type { Papel } from "@prisma/client";

const vazio: EstadoAjustes = {};

export const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";
const botao = "rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60";
const botaoSecundario = "rounded-xl border border-borda px-4 py-2.5 text-sm disabled:opacity-60";

export function Aviso({ estado }: { estado: EstadoAjustes }) {
  if (estado.erro) {
    return <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>;
  }
  if (estado.ok) {
    return <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>;
  }
  return null;
}

/** Seção padrão das telas de configuração: título, explicação curta e o conteúdo num cartão. */
export function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</h2>
      {descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}
      <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">{children}</div>
    </section>
  );
}

export function FormPuxarMeta({ clienteId }: { clienteId: string }) {
  const [estado, sincronizar, sincronizando] = useActionState(acaoSincronizarMeta, vazio);
  return (
    <Formulario acao={sincronizar} className="flex flex-col gap-2 border-t border-borda pt-3">
      <input type="hidden" name="clienteId" value={clienteId} />
      <p className="text-xs text-suave">
        O gasto é atualizado sozinho todo dia de manhã. Depois de ligar uma conta, puxe os últimos 90
        dias para já ter histórico no relatório.
      </p>
      <Aviso estado={estado} />
      <button type="submit" disabled={sincronizando} className={botaoSecundario}>
        {sincronizando ? "Buscando no Meta... pode levar um minuto" : "Puxar dados do Meta agora"}
      </button>
    </Formulario>
  );
}

export function FormApiConversoes({ clienteId, ligada }: { clienteId: string; ligada: boolean }) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarCredenciais, vazio);
  // Token não pode ficar na tela depois de salvo.
  const chave = useLimparAoConcluir(estado);
  return (
    <Formulario key={chave} acao={salvar} className="flex flex-col gap-3">
      <input type="hidden" name="clienteId" value={clienteId} />
      <p className="text-sm">
        <span className={ligada ? "text-ok" : "text-suave"}>●</span>{" "}
        {ligada ? "Ligada: leads e vendas vão ao Meta pelo servidor." : "Desligada."}
      </p>
      <input name="pixelId" placeholder="ID do pixel" className={campo} />
      <input name="capiToken" type="password" autoComplete="off" placeholder="Token da API de Conversões" className={campo} />
      <p className="text-xs text-suave">Os dois vêm do Gerenciador de Eventos do cliente. Campo em branco mantém o valor atual.</p>
      <Aviso estado={estado} />
      <button type="submit" disabled={salvando} className={botao}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </Formulario>
  );
}

export function FormFunil({ clienteId, funilAtual }: { clienteId: string; funilAtual: string }) {
  const [estado, trocar, trocando] = useActionState(acaoTrocarFunil, vazio);
  return (
    <Formulario acao={trocar} className="flex flex-col gap-3">
      <input type="hidden" name="clienteId" value={clienteId} />
      <select name="funil" defaultValue={funilAtual} className={campo}>
        {Object.entries(ROTULO_FUNIL).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
      <Aviso estado={estado} />
      <button type="submit" disabled={trocando} className={botao}>
        {trocando ? "Salvando..." : "Salvar funil"}
      </button>
    </Formulario>
  );
}

export function FormSenha() {
  const [estado, trocar, trocando] = useActionState(acaoTrocarSenha, vazio);
  const chave = useLimparAoConcluir(estado);
  return (
    <Formulario key={chave} acao={trocar} className="flex flex-col gap-3">
      <input name="atual" type="password" autoComplete="current-password" placeholder="Senha atual" required className={campo} />
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
      <Aviso estado={estado} />
      <button type="submit" disabled={trocando} className={botao}>
        {trocando ? "Trocando..." : "Trocar senha"}
      </button>
    </Formulario>
  );
}

const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: "Administrador da agência",
  GESTOR: "Gestor (vê números e relatórios)",
  ATENDENTE: "Atendente (só leads)",
};

/**
 * Novo usuário. Na tela do cliente, a pessoa entra na equipe daquele cliente;
 * em Minha conta, entra na equipe da agência. Não há como criar usuário no
 * cliente errado: o cliente vem fixo da tela.
 */
export function FormNovoUsuario({ clienteId, papeis }: { clienteId: string | null; papeis: Papel[] }) {
  const [estado, criar, criando] = useActionState(acaoCriarUsuario, vazio);
  const chave = useLimparAoConcluir(estado);
  const [aberto, setAberto] = useState(false);
  // Criou, fecha: o aviso fica e o botão volta. (Ajuste de estado no render,
  // o jeito do React para derivar de uma mudança sem efeito extra.)
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setAberto(false);
  }
  if (!aberto) {
    return (
      <div className="flex flex-col gap-2">
        {estado.ok && <Aviso estado={estado} />}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-xl border border-dashed border-borda px-4 py-2.5 text-left text-sm text-suave hover:border-marca hover:text-texto"
        >
          + Adicionar pessoa
        </button>
      </div>
    );
  }
  return (
    <Formulario
      key={chave}
      acao={criar}
      className="flex flex-col gap-3 border-t border-borda pt-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Adicionar pessoa</p>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-suave">
          Cancelar
        </button>
      </div>
      <input type="hidden" name="clienteId" value={clienteId ?? ""} />
      <input name="nome" placeholder="Nome" required className={campo} />
      <input name="email" type="email" placeholder="E-mail" required className={campo} />
      <input name="senha" type="password" autoComplete="new-password" placeholder="Senha inicial (mínimo 8 caracteres)" required className={campo} />
      {papeis.length > 1 ? (
        <select name="papel" defaultValue={papeis[0]} className={campo}>
          {papeis.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="papel" value={papeis[0]} />
      )}
      <Aviso estado={estado} />
      <button type="submit" disabled={criando} className={botao}>
        {criando ? "Criando..." : "Criar acesso"}
      </button>
    </Formulario>
  );
}

export function FormNumero({ clienteId, atual }: { clienteId: string; atual: string | null }) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarNumero, vazio);
  return (
    <Formulario acao={salvar} className="flex flex-wrap gap-2">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input
        name="numero"
        type="tel"
        inputMode="tel"
        defaultValue={atual ?? ""}
        placeholder="(11) 99999-9999"
        className={`${campo} min-w-[12rem] flex-1`}
      />
      <button type="submit" disabled={salvando} className={`${botaoSecundario} shrink-0`}>
        {salvando ? "Salvando..." : "Salvar número"}
      </button>
      <div className="w-full empty:hidden">
        <Aviso estado={estado} />
      </div>
    </Formulario>
  );
}
