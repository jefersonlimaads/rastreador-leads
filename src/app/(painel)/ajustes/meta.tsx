"use client";

import { useActionState, useState } from "react";
import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import {
  acaoDesvincularConta,
  acaoSalvarTokenAgencia,
  acaoVincularConta,
  type EstadoAjustes,
} from "./acoes";

const vazio: EstadoAjustes = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";
const botao = "rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60";

function Aviso({ estado }: { estado: EstadoAjustes }) {
  if (estado.erro) return <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>;
  if (estado.ok) return <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>;
  return null;
}

/**
 * Conexão da agência com o Meta: um token para todos os clientes. Depois dela,
 * ligar a conta de um cliente é escolher na lista, sem copiar número.
 */
export function ConexaoMeta({
  mascara,
  contasVisiveis,
  erroLista,
}: {
  mascara: string | null;
  contasVisiveis: number;
  erroLista: string | null;
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarTokenAgencia, vazio);
  const chave = useLimparAoConcluir(estado);
  const [trocar, setTrocar] = useState(false);
  const conectado = Boolean(mascara);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Conexão com o Meta</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        {conectado ? (
          <p className="text-sm">
            <span className={erroLista ? "text-alerta" : "text-ok"}>●</span> Token da agência {mascara}
            {erroLista
              ? ` · o Meta recusou: ${erroLista}`
              : ` · ${contasVisiveis} ${contasVisiveis === 1 ? "conta de anúncios visível" : "contas de anúncios visíveis"}`}
          </p>
        ) : (
          <p className="text-sm text-suave">
            Cole o token do usuário do sistema da BM da agência. Ele vale para todos os clientes:
            cada cliente só precisa compartilhar a conta de anúncios com a BM da agência.
          </p>
        )}
        {conectado && !trocar ? (
          <button type="button" onClick={() => setTrocar(true)} className="self-start text-sm text-marca-texto">
            Trocar token
          </button>
        ) : (
          <Formulario key={chave} acao={salvar} className="flex flex-col gap-3">
            <input name="token" type="password" autoComplete="off" placeholder="Token do usuário do sistema" className={campo} />
            <Aviso estado={estado} />
            <button type="submit" disabled={salvando} className={botao}>
              {salvando ? "Testando no Meta..." : "Conectar"}
            </button>
          </Formulario>
        )}
        {conectado && !trocar && <Aviso estado={estado} />}
      </div>
    </section>
  );
}

export type ContaListada = { contaId: string; nome: string; negocio: string | null; ativa: boolean; usadaPor: string | null };

/** Contas de anúncios de um cliente: as ligadas, e a escolha de uma nova. */
export function ContasDoCliente({
  clienteId,
  nomeCliente,
  ligadas,
  disponiveis,
}: {
  clienteId: string;
  nomeCliente: string;
  ligadas: { id: string; contaId: string; nome: string | null }[];
  disponiveis: ContaListada[];
}) {
  const [estado, vincular, vinculando] = useActionState(acaoVincularConta, vazio);
  const chave = useLimparAoConcluir(estado);
  const livres = disponiveis.filter((c) => !c.usadaPor);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
        Contas de anúncios — {nomeCliente}
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        {ligadas.length === 0 ? (
          <p className="text-sm text-suave">Nenhuma conta ligada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ligadas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-3 py-2">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{c.nome ?? disponiveis.find((d) => d.contaId === c.contaId)?.nome ?? "Conta"}</span>
                  <span className="block text-xs text-suave">{c.contaId}</span>
                </span>
                <form action={acaoDesvincularConta}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-sm text-alerta">
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <Formulario key={chave} acao={vincular} className="flex flex-col gap-2 border-t border-borda pt-3">
          <input type="hidden" name="clienteId" value={clienteId} />
          {livres.length > 0 ? (
            <select name="conta" defaultValue="" className={campo}>
              <option value="">Escolha uma conta para ligar</option>
              {livres.map((c) => (
                <option key={c.contaId} value={`${c.contaId}|${c.nome}`}>
                  {c.nome}
                  {c.negocio ? ` — ${c.negocio}` : ""}
                  {c.ativa ? "" : " (inativa)"}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-suave">
              A conta não aparece? Na BM do cliente, compartilhe a conta com a BM da agência (Parceiros) e,
              na BM da agência, atribua ao usuário do sistema.
            </p>
          )}
          <input name="contaDigitada" placeholder="ou digite o número da conta" className={campo} />
          <Aviso estado={estado} />
          <button type="submit" disabled={vinculando} className={botao}>
            {vinculando ? "Ligando..." : "Ligar conta"}
          </button>
        </Formulario>
      </div>
    </section>
  );
}
