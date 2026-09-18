"use client";

import { useActionState } from "react";
import { acaoSalvarProposta, type EstadoProposta } from "./acoes";

const vazio: EstadoProposta = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

export type ValoresProposta = {
  propostaId?: string;
  clienteId: string;
  titulo: string;
  apresentacao: string;
  escopo: string;
  feeMensal: string;
  setup: string;
  condicoes: string;
  validade: string;
};

/** Modelo de escopo de gestão de tráfego, para não começar do zero toda vez. */
const ESCOPO_PADRAO = `Gestão de campanhas no Meta Ads: estrutura, criação e otimização contínua
Rastreamento de leads: cada conversa no WhatsApp ligada ao anúncio que a gerou
Painel de resultados: leads, custo por lead e custo por cliente, atualizado todo dia
Criativos: roteiro e direção de até 4 peças por mês
Reunião mensal de resultado: o que funcionou, o que muda no mês seguinte`;

const CONDICOES_PADRAO = `Contrato mínimo de 3 meses.
Verba de anúncios paga direto ao Meta pelo cliente, à parte do valor mensal.
Pagamento mensal até o dia 10.`;

export function FormularioProposta({
  valores,
  clientes,
}: {
  valores: ValoresProposta;
  clientes: { id: string; nome: string }[];
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarProposta, vazio);
  const nova = !valores.propostaId;

  return (
    <form action={salvar} className="mt-5 flex flex-col gap-4">
      {valores.propostaId && <input type="hidden" name="propostaId" value={valores.propostaId} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Para quem</span>
        <select name="clienteId" defaultValue={valores.clienteId} className={campo}>
          <option value="">Prospect novo (digite abaixo)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      {nova && (
        <input
          name="novoProspect"
          placeholder="Nome do prospect novo, se não estiver na lista"
          className={campo}
        />
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Título</span>
        <input
          name="titulo"
          required
          defaultValue={valores.titulo}
          placeholder="Gestão de tráfego para a Clínica Exemplo"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Abertura</span>
        <textarea
          name="apresentacao"
          rows={4}
          defaultValue={valores.apresentacao}
          placeholder="O problema que você entendeu na conversa, em duas ou três frases. É o que prova que a proposta foi escrita para ele."
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">O que está incluído</span>
        <textarea
          name="escopo"
          rows={7}
          required
          defaultValue={valores.escopo || ESCOPO_PADRAO}
          className={campo}
        />
        <span className="text-xs text-suave">
          Um item por linha. Use &quot;Título: detalhe&quot; para separar as duas partes.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Valor mensal (R$)</span>
          <input name="feeMensal" inputMode="decimal" defaultValue={valores.feeMensal} placeholder="1800,00" className={campo} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Implantação (R$)</span>
          <input name="setup" inputMode="decimal" defaultValue={valores.setup} placeholder="opcional" className={campo} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Condições</span>
        <textarea
          name="condicoes"
          rows={3}
          defaultValue={valores.condicoes || CONDICOES_PADRAO}
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Válida até</span>
        <input name="validade" type="date" required defaultValue={valores.validade} className={campo} />
      </label>

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="rounded-xl bg-marca px-4 py-3 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {salvando ? "Salvando..." : nova ? "Criar proposta" : "Salvar alterações"}
      </button>
    </form>
  );
}
